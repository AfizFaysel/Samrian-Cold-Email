import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const imap = vi.hoisted(() => ({
  search: vi.fn(),
  download: vi.fn(),
  message: undefined as unknown,
}));

vi.mock("imapflow", () => ({
  ImapFlow: class {
    connect = async () => {};
    logout = async () => {};
    getMailboxLock = async () => ({ release: () => {} });
    search = imap.search;
    download = imap.download;
    async *fetch() {
      yield* [imap.message].flat();
    }
  },
}));

vi.mock("../../lib/email-connectors/oauth", () => ({
  refreshAccessToken: vi.fn(async () => ({ accessToken: "access", expiresIn: 3600 })),
}));

import { GmailApiConnector } from "../../lib/email-connectors/gmail";
import { MicrosoftGraphConnector } from "../../lib/email-connectors/microsoft";
import { SmtpImapConnector } from "../../lib/email-connectors/smtp-imap";
import type { SendOptions } from "../../lib/email-connectors/types";

const message: SendOptions = {
  from: "sender@example.com",
  to: "to@example.com",
  subject: "Subject",
  html: "<p>Hello</p>",
  text: "Hello",
};

const gmail = () =>
  new GmailApiConnector(
    { provider: "google", userEmail: "sender@example.com" },
    { type: "oauth2", refreshToken: "refresh" }
  );
const graph = () =>
  new MicrosoftGraphConnector(
    { provider: "microsoft", userEmail: "sender@example.com" },
    { type: "oauth2", refreshToken: "refresh" }
  );

type Handler = (url: string, init?: RequestInit) => Response;

function stubFetch(handler: Handler) {
  const fetch = vi.fn(async (url: string | URL, init?: RequestInit) => handler(String(url), init));
  vi.stubGlobal("fetch", fetch);
  return {
    urls: () => fetch.mock.calls.map(([url]) => String(url)),
    init: (match: string) => fetch.mock.calls.find(([url]) => String(url).includes(match))?.[1],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("Gmail send", () => {
  const sent = () => Response.json({ id: "gmail_1", threadId: "thread_1" });

  test("returns the Message-ID Gmail really sent, and the thread", async () => {
    stubFetch((url) =>
      url.includes("/messages/send")
        ? sent()
        : Response.json({
            payload: { headers: [{ name: "Message-Id", value: "<real@mail.gmail.com>" }] },
          })
    );

    await expect(gmail().send(message)).resolves.toMatchObject({
      messageId: "<real@mail.gmail.com>",
      providerThreadId: "thread_1",
    });
  });

  test("a failed lookup after sending does not fail the send", async () => {
    stubFetch((url) =>
      url.includes("/messages/send") ? sent() : new Response(null, { status: 500 })
    );

    await expect(gmail().send(message)).resolves.toMatchObject({
      messageId: "<gmail_1@mail.gmail.com>",
      providerThreadId: "thread_1",
    });
  });

  test("sends a reply into its Gmail thread", async () => {
    const calls = stubFetch(sent);

    await gmail().send({ ...message, providerThreadId: "thread_9" });

    const body = JSON.parse(String(calls.init("/messages/send")?.body)) as { threadId: string };
    expect(body.threadId).toBe("thread_9");
  });
});

describe("Microsoft send", () => {
  const draft = () =>
    Response.json({
      id: "draft_1",
      internetMessageId: "<real@outlook.com>",
      conversationId: "conversation_1",
    });

  test.each([
    ["JSON", { ...message }, "application/json"],
    ["MIME", { ...message, headers: { "List-Unsubscribe": "<https://a.test/u>" } }, "text/plain"],
  ])("%s path returns the real Message-ID and conversation", async (_path, input, type) => {
    const calls = stubFetch((url) =>
      url.endsWith("/send") ? new Response(null, { status: 202 }) : draft()
    );

    await expect(graph().send(input)).resolves.toMatchObject({
      messageId: "<real@outlook.com>",
      providerThreadId: "conversation_1",
    });

    expect(calls.urls()).toEqual([
      "https://graph.microsoft.com/v1.0/me/messages",
      "https://graph.microsoft.com/v1.0/me/messages/draft_1/send",
    ]);
    expect(calls.init("/me/messages")?.headers).toMatchObject({ "Content-Type": type });
  });

  test("removes the draft when sending fails", async () => {
    const calls = stubFetch((url, init) => {
      if (url.endsWith("/send")) return new Response("nope", { status: 403 });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return draft();
    });

    await expect(graph().send(message)).rejects.toThrow();

    expect(calls.urls()).toContain("https://graph.microsoft.com/v1.0/me/messages/draft_1");
  });
});

describe("polling past unrelated unread mail", () => {
  const since = Date.parse("2026-07-06T12:00:00.000Z");

  test("Gmail scans from the cursor and follows pages", async () => {
    const calls = stubFetch((url) => {
      if (url.includes("pageToken=next")) return Response.json({ messages: [{ id: "m2" }] });
      if (url.includes("?q=")) {
        return Response.json({ messages: [{ id: "m1" }], nextPageToken: "next" });
      }
      return Response.json({ id: "m", threadId: "t", payload: { headers: [] } });
    });

    await expect(gmail().pollNewMessages({ since })).resolves.toHaveLength(2);

    expect(decodeURIComponent(calls.urls()[0])).toContain(`after:${since / 1000}`);
  });

  test("Gmail includes replies that landed in Spam but not Trash", async () => {
    const calls = stubFetch(() => Response.json({}));

    await gmail().pollNewMessages();

    const list = new URL(calls.urls()[0]);
    expect(list.searchParams.get("includeSpamTrash")).toBe("true");
    expect(list.searchParams.get("q")).toBe("is:unread -in:trash");
  });

  test("Gmail stops at the page limit", async () => {
    const calls = stubFetch((url) =>
      url.includes("?q=")
        ? Response.json({ messages: [], nextPageToken: "more" })
        : Response.json({})
    );

    await gmail().pollNewMessages();

    expect(calls.urls().filter((url) => url.includes("?q="))).toHaveLength(5);
  });

  test("Microsoft scans from the cursor and follows pages", async () => {
    const next = "https://graph.microsoft.com/v1.0/me/messages?$skip=50";
    const calls = stubFetch((url) =>
      url === next
        ? Response.json({ value: [{ id: "m2", internetMessageId: "<2@x>" }] })
        : Response.json({
            value: [{ id: "m1", internetMessageId: "<1@x>" }],
            "@odata.nextLink": next,
          })
    );

    await expect(graph().pollNewMessages({ since })).resolves.toHaveLength(2);

    expect(calls.urls()[0]).toContain("receivedDateTime ge 2026-07-06T12:00:00.000Z");
  });

  test("Microsoft ignores a next link pointing elsewhere", async () => {
    const calls = stubFetch(() =>
      Response.json({ value: [], "@odata.nextLink": "https://evil.example/steal" })
    );

    await graph().pollNewMessages();

    expect(calls.urls()).toHaveLength(1);
  });
});

describe("IMAP bodies", () => {
  const connector = () =>
    new SmtpImapConnector(
      {
        provider: "smtp",
        imapHost: "imap.example.com",
        imapPort: 993,
        username: "sender@example.com",
      },
      { type: "smtp-imap", password: "secret" },
      async () => ({ address: "203.0.113.1", servername: "imap.example.com" })
    );

  beforeEach(() => {
    vi.clearAllMocks();
    imap.search.mockResolvedValue([7]);
    imap.download.mockImplementation(async (_uid: string, part: string) => ({
      meta: {},
      content: Readable.from([Buffer.from(`body of ${part}`)]),
    }));
    imap.message = {
      uid: 7,
      envelope: { messageId: "<in@x>", from: [{ address: "ada@example.com" }] },
      source: Buffer.from("From: ada@example.com\r\n\r\nraw"),
      bodyStructure: {
        type: "multipart/mixed",
        childNodes: [
          { part: "1", type: "text/plain", size: 10 },
          { part: "2", type: "text/html", size: 10 },
          { part: "3", type: "message/delivery-status", size: 10 },
          { part: "4", type: "text/plain", size: 10, disposition: "attachment" },
        ],
      },
    };
  });

  test("reads text, html, and the delivery report, skipping attachments", async () => {
    const [polled] = await connector().pollNewMessages();

    expect(polled).toMatchObject({
      textBody: "body of 1\nbody of 3",
      htmlBody: "body of 2",
      partMimeTypes: [
        "multipart/mixed",
        "text/plain",
        "text/html",
        "message/delivery-status",
        "text/plain",
      ],
    });
    expect(imap.download).toHaveBeenCalledWith("7", "1", expect.objectContaining({ uid: true }));
    expect(imap.download).not.toHaveBeenCalledWith("7", "4", expect.anything());
  });

  test("reads a single-part message", async () => {
    imap.message = {
      ...(imap.message as object),
      bodyStructure: { type: "text/plain", size: 10 },
    };

    const [polled] = await connector().pollNewMessages();

    expect(polled.textBody).toBe("body of 1");
  });

  test("one unreadable message does not block the ones after it", async () => {
    const readable = imap.message as object;
    imap.message = [{ ...readable, uid: 6, envelope: { messageId: "<bad@x>" } }, readable];
    imap.download.mockImplementation(async (uid: string, part: string) => {
      if (uid === "6") throw new Error("connection reset");
      return { meta: {}, content: Readable.from([Buffer.from(`body of ${part}`)]) };
    });

    const polled = await connector().pollNewMessages();

    expect(polled.map((item) => item.messageId)).toEqual(["<in@x>"]);
  });

  test("searches from the cursor", async () => {
    const since = Date.parse("2026-07-06T12:00:00.000Z");

    await connector().pollNewMessages({ since });

    expect(imap.search).toHaveBeenCalledWith(
      { seen: false, since: new Date(since) },
      { uid: true }
    );
  });
});
