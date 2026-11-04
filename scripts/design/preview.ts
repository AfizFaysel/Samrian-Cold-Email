/**
 * Design preview server for local QA and the design-system export. Development only.
 *
 * Proxies pages from the dev server and answers /api/* with sample data, signed in as a
 * sample user, so every screen renders without a database. Run `bun run dev`, then
 * `bun run design:preview`, then open http://localhost:3101/design and click Export HTML
 * (or http://localhost:3101/dashboard to click around).
 *
 * States: /__mock/data | /__mock/empty | /__mock/error, /__mock/signed-out | /__mock/signed-in.
 * Writes are accepted and discarded. The app's X-Frame-Options header is dropped here only,
 * so the export can capture screens in same-origin frames.
 */

import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";

const UPSTREAM = process.env.DESIGN_UPSTREAM ?? "http://localhost:3000";
const PORT = Number(process.env.DESIGN_PORT ?? 3101);
const OUTPUT = new URL("../../docs/design-system.html", import.meta.url);
let mode: "data" | "empty" | "error" = "data";
let signedOut = false;

const day = 86400000;

function fixtures() {
  const now = Date.now();
  const campaigns = [
    {
      _id: "cmp_1",
      name: "Q4 founders outreach",
      status: "active",
      _creationTime: now - 3 * day,
      emailsSent: 1284,
      replyRate: 8.4,
      bounceRate: 1.2,
      mailboxIds: ["mb_1", "mb_2"],
    },
    {
      _id: "cmp_2",
      name: "Agency partners",
      status: "active",
      _creationTime: now - 9 * day,
      emailsSent: 642,
      replyRate: 11.2,
      bounceRate: 0.8,
      mailboxIds: ["mb_1"],
    },
    {
      _id: "cmp_3",
      name: "Webinar follow-up",
      status: "completed",
      _creationTime: now - 40 * day,
      emailsSent: 2010,
      replyRate: 5.9,
      bounceRate: 6.1,
      mailboxIds: ["mb_2"],
    },
    {
      _id: "cmp_4",
      name: "Series A investors",
      status: "paused",
      _creationTime: now - 14 * day,
      emailsSent: 120,
      replyRate: 3.3,
      bounceRate: 0,
      mailboxIds: ["mb_3"],
    },
    {
      _id: "cmp_5",
      name: "Hiring: senior engineers",
      status: "draft",
      _creationTime: now - 2 * 3600000,
      emailsSent: 0,
      replyRate: 0,
      bounceRate: 0,
    },
  ];
  const mailboxes = [
    {
      _id: "mb_1",
      name: "Ada (Google)",
      provider: "google",
      userEmail: "ada@acme.dev",
      status: "active",
      dailySendLimit: 50,
      emailsSentToday: 32,
      rampEnabled: true,
      rampStatus: "ramping",
      rampCurrentLimit: 25,
      rampTargetLimit: 40,
      effectiveDailyLimit: 25,
      availableToday: 8,
      lastConnectionTestAt: now - 3600000,
    },
    {
      _id: "mb_2",
      name: "Sales (Microsoft)",
      provider: "microsoft",
      userEmail: "sales@acme.dev",
      status: "active",
      dailySendLimit: 80,
      emailsSentToday: 12,
      rampEnabled: false,
      rampStatus: "off",
      rampTargetLimit: 30,
      effectiveDailyLimit: 80,
      availableToday: 68,
      lastConnectionTestAt: now - 7200000,
    },
    {
      _id: "mb_3",
      name: "Outreach SMTP",
      provider: "smtp",
      username: "hello@acme-mail.io",
      status: "disconnected",
      dailySendLimit: 40,
      emailsSentToday: 0,
      rampEnabled: false,
      rampStatus: "off",
      rampTargetLimit: 30,
      effectiveDailyLimit: 40,
      availableToday: 0,
      lastConnectionError: "Authentication failed (535)",
    },
  ];
  const names = [
    ["Grace Hopper", "Navy Labs"],
    ["Alan Turing", "Bletchley"],
    ["Katherine Johnson", "Langley"],
    ["Linus Torvalds", "Kernel Co"],
    ["Margaret Hamilton", "Apollo Systems"],
    ["Tim Berners-Lee", "W3 Partners"],
    ["Barbara Liskov", "CLU Labs"],
  ];
  const contacts = names.map(([name, company], i) => ({
    _id: "ct_" + i,
    _creationTime: now - i * day,
    orgId: "org_1",
    email:
      name.toLowerCase().replace(/[^a-z]+/g, ".") +
      "@" +
      company.toLowerCase().replace(/[^a-z]+/g, "") +
      ".com",
    customVars: { name, company, title: i % 2 ? "CTO" : "Head of Growth" },
    timezone: ["America/New_York", "Europe/London", undefined, "Asia/Tokyo"][i % 4],
    bounceStatus: i === 3 ? "hard" : i === 5 ? "soft" : undefined,
  }));
  const threads = [
    {
      id: "th_1",
      sender: { name: "Grace Hopper", address: "grace.hopper@navylabs.com", suspicious: false },
      subject: "Re: Quick question about your outbound",
      excerpt:
        "Thanks for reaching out! We are actually evaluating tools this quarter, could you share pricing?",
      unread: true,
      receivedAt: now - 1800000,
    },
    {
      id: "th_2",
      sender: { name: "Alan Turing", address: "alan.turing@bletchley.com", suspicious: false },
      subject: "Re: Partnership idea",
      excerpt: "Interesting. Let's set up a call next week.",
      unread: true,
      receivedAt: now - 5 * 3600000,
    },
    {
      id: "th_3",
      sender: { name: "Katherine Johnson", address: "katherine@langley.com", suspicious: true },
      subject: "Re: Following up",
      excerpt: "Not the right time for us, maybe in Q2.",
      unread: false,
      receivedAt: now - 2 * day,
    },
  ];
  const routes: Array<[RegExp, (m: RegExpMatchArray) => unknown]> = [
    [
      /^\/api\/auth\/session/,
      () => ({
        user: { id: "u_1", name: "Ada Lovelace", email: "ada@acme.dev" },
        session: { activeOrganizationId: "org_1" },
      }),
    ],
    [
      /^\/api\/analytics\/org/,
      () => ({
        totalSent: 4056,
        estimatedOpenRate: null,
        openTrackingEnabled: false,
        replyRate: 7.8,
        bounceRate: 2.4,
        unsubscribeRate: 0.6,
        clickRate: 1.9,
      }),
    ],
    [
      /^\/api\/campaigns\/[^/]+\/stats/,
      () => ({
        totalContacts: 420,
        emailsSent: 1284,
        replyRate: 8.4,
        activeContacts: 260,
        repliedContacts: 36,
        bouncedContacts: 15,
        completedContacts: 109,
      }),
    ],
    [
      /^\/api\/campaigns\/[^/]+\/assignments/,
      () => ({
        page: contacts.slice(0, 5).map((c, i) => ({
          _id: "as_" + i,
          contactId: c._id,
          status: ["active", "replied", "bounced", "completed", "active"][i],
          currentStep: (i % 3) + 1,
          lastEmailSentAt: now - i * day,
        })),
        isDone: true,
        continueCursor: null,
      }),
    ],
    [
      /^\/api\/campaigns\/([^/?]+)/,
      (m) => ({
        campaign: {
          ...(campaigns.find((c) => c._id === m[1]) ?? campaigns[0]),
          schedule: {
            defaultTimezone: "America/New_York",
            startTime: "09:00",
            endTime: "17:00",
            daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday"],
          },
          steps: [{ subject: "Quick question, {{name}}", body: "Hi {{name}}, ..." }],
        },
      }),
    ],
    [/^\/api\/campaigns/, () => ({ campaigns })],
    [/^\/api\/mailboxes/, () => ({ mailboxes })],
    [
      /^\/api\/contacts\/([^/?]+)/,
      (m) => ({
        contact: contacts.find((c) => c._id === m[1]) ?? contacts[0],
        history: {
          page: [
            {
              _id: "as_1",
              campaignId: "cmp_1",
              status: "replied",
              currentStep: 2,
              lastEmailSentAt: now - day,
              _creationTime: now - 5 * day,
            },
            {
              _id: "as_2",
              campaignId: "cmp_3",
              status: "completed",
              currentStep: 3,
              _creationTime: now - 30 * day,
            },
          ],
        },
      }),
    ],
    [/^\/api\/contacts/, () => ({ contacts })],
    [/^\/api\/groups/, () => ({ groups: [{ _id: "g_1", name: "Founders", count: 120 }] })],
    [
      /^\/api\/inbox\/threads\/([^/?]+)/,
      (m) => {
        const t = threads.find((x) => x.id === m[1]) ?? threads[0];
        return {
          thread: t,
          messages: [
            {
              id: "msg_1",
              direction: "sent",
              subject: t.subject,
              displayText:
                "Hi " +
                t.sender.name.split(" ")[0] +
                ",\n\nI noticed your team is scaling outbound. Samrian keeps every reply in one inbox and stays under each mailbox's limits.\n\nWorth a quick chat?\n\nAda",
              sentAt: now - day,
            },
            {
              id: "msg_2",
              direction: "received",
              from: t.sender.address,
              subject: t.subject,
              displayText: t.excerpt + "\n\nBest,\n" + t.sender.name,
              receivedAt: t.receivedAt,
              links: [{ url: "https://calendly.com/example", hostname: "calendly.com" }],
            },
          ],
        };
      },
    ],
    [/^\/api\/inbox/, () => ({ threads, unreadCount: 2 })],
    [
      /^\/api\/notifications/,
      () => ({
        notifications: [
          {
            id: "n_1",
            type: "reply",
            title: "Grace Hopper replied",
            body: "Re: Quick question about your outbound",
            createdAt: now - 1800000,
            data: { threadId: "th_1" },
          },
          {
            id: "n_2",
            type: "info",
            title: "Outreach SMTP disconnected",
            body: "Authentication failed",
            createdAt: now - 3 * 3600000,
            readAt: now,
          },
        ],
        unreadCount: 1,
      }),
    ],
    [
      /^\/api\/blocklist/,
      () => ({
        page: [
          {
            _id: "b1",
            email: "no.thanks@example.com",
            reason: "unsubscribed",
            createdAt: now - day,
          },
          {
            _id: "b2",
            email: "bounced@oldco.com",
            reason: "bounced_hard",
            createdAt: now - 4 * day,
          },
          { _id: "b3", email: "competitor@rival.io", reason: "manual", createdAt: now - 20 * day },
        ],
      }),
    ],
    [
      /^\/api\/settings\/roles/,
      () => ({
        roles: [
          { id: "owner", slug: "owner", name: "Owner", permissions: ["*"], builtIn: true },
          {
            id: "member",
            slug: "member",
            name: "Member",
            permissions: ["campaigns:read"],
            builtIn: true,
          },
          {
            id: "r_ops",
            slug: "campaign-operator",
            name: "Campaign operator",
            permissions: ["campaigns:read", "campaigns:write"],
            builtIn: false,
          },
        ],
        permissions: ["campaigns:read", "campaigns:write", "contacts:read", "contacts:write"],
      }),
    ],
    [
      /^\/api\/settings\/members/,
      () => [
        { id: "m1", userId: "u_1", email: "ada@acme.dev", name: "Ada Lovelace", role: "owner" },
      ],
    ],
    [/^\/api\/settings\/api-keys/, () => []],
    [
      /^\/api\/settings\/compliance/,
      () => ({
        listUnsubscribeEnabled: false,
        physicalAddress: "1 Market St, San Francisco, CA",
        defaultSenderName: "Ada from Acme",
        bouncePauseRate: 0.05,
        unsubscribePauseRate: 0.1,
        complaintPauseRate: 0.001,
      }),
    ],
    [/^\/api\/settings\/notifications/, () => ({})],
    [
      /^\/api\/settings\/sending/,
      () => ({ defaultRampEnabled: true, defaultRampTarget: 30, replyReserve: 2 }),
    ],
  ];
  return routes;
}

function emptied(body: unknown): unknown {
  const out = JSON.parse(JSON.stringify(body), (key, value) =>
    Array.isArray(value) && key !== "permissions" && key !== "daysAllowed" ? [] : value
  );
  if (out && typeof out === "object") {
    if ("totalSent" in out)
      Object.assign(out, {
        totalSent: 0,
        replyRate: 0,
        bounceRate: 0,
        unsubscribeRate: 0,
        clickRate: 0,
      });
    if ("unreadCount" in out) out.unreadCount = 0;
  }
  return out;
}

function mockApi(method: string, path: string): Response {
  if (method !== "GET") return Response.json({ ok: true, id: "mock_" + Date.now() });
  const routes = fixtures();
  if (path.startsWith("/api/auth/session")) {
    return signedOut
      ? Response.json(null)
      : Response.json(routes[0][1]([] as unknown as RegExpMatchArray));
  }
  if (mode === "error" && !path.startsWith("/api/notifications")) {
    return Response.json({ error: "Mock failure" }, { status: 500 });
  }
  for (const [pattern, handler] of routes) {
    const match = path.match(pattern);
    if (match) {
      const body = handler(match);
      return Response.json(mode === "empty" ? emptied(body) : body);
    }
  }
  return Response.json({}, { status: 404 });
}

const upstream = new URL(UPSTREAM);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname + url.search;
  const send = async (response: Response) => {
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    delete headers["x-frame-options"];
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  };
  const body = async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks);
  };

  const switchTo = url.pathname.match(/^\/__mock\/(data|empty|error)$/);
  if (switchTo) {
    mode = switchTo[1] as typeof mode;
    return send(new Response(null, { status: 302, headers: { Location: "/dashboard" } }));
  }
  if (url.pathname === "/__mock/signed-out" || url.pathname === "/__mock/signed-in") {
    signedOut = url.pathname.endsWith("out");
    return send(new Response(null, { status: 204 }));
  }
  // The /design export hands its finished file to disk here.
  if (url.pathname === "/__save" && req.method === "POST") {
    await writeFile(OUTPUT, await body());
    return send(Response.json({ saved: OUTPUT.pathname }));
  }
  if (url.pathname.startsWith("/api/")) return send(mockApi(req.method ?? "GET", path));

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  headers.set("host", upstream.host);
  headers.delete("origin");
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  send(
    await fetch(UPSTREAM + path, {
      method: req.method,
      headers,
      body: hasBody ? new Uint8Array(await body()) : undefined,
      redirect: "manual",
    })
  );
});

// Hot reload and other websockets pass straight through as raw TCP.
server.on("upgrade", (req, socket, head) => {
  const target = connect(Number(upstream.port || 80), upstream.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      lines.push(`${key}: ${key.toLowerCase() === "host" ? upstream.host : req.rawHeaders[i + 1]}`);
    }
    target.write(lines.join("\r\n") + "\r\n\r\n");
    target.write(head);
    socket.pipe(target).pipe(socket);
  });
  target.on("error", () => socket.destroy());
  socket.on("error", () => target.destroy());
});

server.listen(PORT, () => {
  console.log(`Design preview on http://localhost:${PORT} (proxying ${UPSTREAM})`);
});
