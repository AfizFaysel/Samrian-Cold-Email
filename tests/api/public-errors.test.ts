import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DELETE as deleteMailbox } from "../../src/app/api/mailboxes/[id]/route";
import { POST as reply } from "../../src/app/api/inbox/threads/[id]/reply/route";
import { PATCH as updateMember } from "../../src/app/api/settings/members/route";
import { POST as createRole } from "../../src/app/api/settings/roles/route";
import { createRequestRoleModule } from "../../src/server/modules/roles";
import { removeMailbox } from "../../src/server/modules/mailboxes";
import { sendReply } from "../../src/server/modules/inbox";
import { PublicError } from "../../src/server/modules/public-error";

const secret = "Gmail API send failed (403): token ya29.secret for ada@example.com";

const session = vi.hoisted(() => ({
  orgId: "org_1",
  userId: "user_1",
  role: "owner",
  db: {},
  tenant: async (operation: (db: unknown) => unknown) => operation({}),
}));

vi.mock("../../src/server/api/session-route", () => {
  const route =
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler(session, ...args);
  return { createSessionRoute: route, createSessionAction: route };
});

vi.mock("../../src/server/modules/inbox", async (original) => ({
  ...(await original<typeof import("../../src/server/modules/inbox")>()),
  sendReply: vi.fn(),
}));

vi.mock("../../src/server/modules/mailboxes", async (original) => ({
  ...(await original<typeof import("../../src/server/modules/mailboxes")>()),
  removeMailbox: vi.fn(),
}));

vi.mock("../../src/server/modules/roles", async (original) => ({
  ...(await original<typeof import("../../src/server/modules/roles")>()),
  createRequestRoleModule: vi.fn(),
}));

vi.mock("../../src/server/auth/provider", () => ({
  getAuthProvider: () => ({ hasPermission: async () => true }),
}));

vi.mock("../../src/server/db/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("../../src/server/observability/runtime", async (original) => ({
  ...(await original<typeof import("../../src/server/observability/runtime")>()),
  errorReporter: { capture: vi.fn() },
}));

const json = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/test", { method, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "id_1" }) };

describe("errors returned to clients", () => {
  beforeEach(() => vi.clearAllMocks());

  test("a provider failure on reply stays out of the response", async () => {
    vi.mocked(sendReply).mockRejectedValue(new Error(secret));

    const response = await reply(json("POST", { body: "Hi", clientRequestId: "r" }), params);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Reply failed" });
  });

  test("a reply rule keeps its message and status", async () => {
    vi.mocked(sendReply).mockRejectedValue(new PublicError("Mailbox is not available", 409));

    const response = await reply(json("POST", { body: "Hi", clientRequestId: "r" }), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Mailbox is not available" });
  });

  test("a failure deleting a mailbox stays out of the response", async () => {
    vi.mocked(removeMailbox).mockRejectedValue(new Error(secret));

    const response = await deleteMailbox(json("DELETE", {}), params);

    await expect(response.json()).resolves.toEqual({ error: "Failed to delete mailbox" });
  });

  test("the linked-campaign rule still explains itself", async () => {
    vi.mocked(removeMailbox).mockRejectedValue(new PublicError("Linked to campaigns", 409));

    const response = await deleteMailbox(json("DELETE", {}), params);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Linked to campaigns" });
  });

  describe("member and role changes", () => {
    const members = [
      { id: "m_1", userId: "user_1", role: "admin" },
      { id: "m_2", userId: "user_2", role: "owner" },
    ];
    const roles = (assign: () => Promise<void>) =>
      ({
        listMembers: async () => members,
        list: async () => [{ slug: "member", permissions: [] }],
        assign: vi.fn(assign),
        create: vi.fn(async () => {
          throw new Error(secret);
        }),
      }) as never;

    test("passes the actor's role so owner protection can apply", async () => {
      const module = roles(async () => {});
      vi.mocked(createRequestRoleModule).mockResolvedValue(module);

      await updateMember(json("PATCH", { memberId: "m_2", role: "member" }));

      expect((module as { assign: unknown }).assign).toHaveBeenCalledWith(
        expect.objectContaining({ actorRole: "admin", currentRole: "owner" })
      );
    });

    test("owner protection answers 403", async () => {
      vi.mocked(createRequestRoleModule).mockResolvedValue(
        roles(async () => {
          throw new PublicError("Only an owner can change an owner", 403);
        })
      );

      const response = await updateMember(json("PATCH", { memberId: "m_2", role: "member" }));

      expect(response.status).toBe(403);
    });

    test("a provider failure stays out of a member change", async () => {
      vi.mocked(createRequestRoleModule).mockResolvedValue(
        roles(async () => {
          throw new Error(secret);
        })
      );

      const response = await updateMember(json("PATCH", { memberId: "m_2", role: "member" }));

      await expect(response.json()).resolves.toEqual({ error: "Member update failed" });
    });

    test("a provider failure stays out of a role change", async () => {
      vi.mocked(createRequestRoleModule).mockResolvedValue(roles(async () => {}));

      const response = await createRole(
        json("POST", { name: "Sales", permissions: ["campaign:read"] })
      );

      await expect(response.json()).resolves.toEqual({ error: "Role operation failed" });
    });
  });
});
