import { describe, expect, test, vi } from "vitest";

import { createSessionAction, createSessionRoute } from "../../../src/server/api/session-route";
import { sessionOperations } from "../../../src/server/auth/policy";
import { AccessError } from "../../../src/server/auth/session";

describe("session route", () => {
  test("runs handler inside authenticated tenant context", async () => {
    const db = { transaction: vi.fn() };
    const auth = { userId: "user_a", orgId: "org_a", role: "owner" };
    const requireAccess = vi.fn().mockResolvedValue(auth);
    const tenant = vi.fn(async (_db, context, operation) => operation({ scoped: true }));
    const handler = vi.fn(async (context) => Response.json(context));
    const route = createSessionRoute(sessionOperations.contactsList, handler, {
      db: db as never,
      requireAccess,
      tenant,
    });

    const response = await route();

    expect(requireAccess).toHaveBeenCalledWith({ contact: ["read"] });
    expect(tenant).toHaveBeenCalledWith(
      db,
      { orgId: "org_a", userId: "user_a", actorType: "request" },
      expect.any(Function)
    );
    await expect(response.json()).resolves.toMatchObject({ orgId: "org_a", db: { scoped: true } });
  });

  test("keeps external action outside tenant transactions", async () => {
    const db = { transaction: vi.fn() };
    const auth = { userId: "user_a", orgId: "org_a", role: "owner" };
    const requireAccess = vi.fn().mockResolvedValue(auth);
    let inTenant = false;
    const tenant = vi.fn(async (_db, _context, operation) => {
      inTenant = true;
      try {
        return await operation({ scoped: true });
      } finally {
        inTenant = false;
      }
    });
    const external = vi.fn(async () => {
      expect(inTenant).toBe(false);
      return "provider-result";
    });
    const action = createSessionAction(
      sessionOperations.contactImport,
      async ({ orgId, tenant: runTenant }) => {
        const row = await runTenant(async (tx) => ({ orgId, tx }));
        const provider = await external();
        const saved = await runTenant(async () => provider);
        return { row, saved };
      },
      { db: db as never, requireAccess, tenant }
    );

    await expect(action()).resolves.toMatchObject({
      row: { orgId: "org_a", tx: { scoped: true } },
      saved: "provider-result",
    });
    expect(tenant).toHaveBeenCalledTimes(2);
  });

  test("records permission denial without running DB work", async () => {
    const warn = vi.fn();
    const db = { transaction: vi.fn() };
    const route = createSessionRoute(
      sessionOperations.contactsUpdate,
      async () => Response.json({ ok: true }),
      {
        db: db as never,
        requireAccess: vi.fn(async () => {
          throw new AccessError("FORBIDDEN", 'Missing permissions: {"contact":["update"]}');
        }),
        logger: { warn },
      }
    );

    const response = await route();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You do not have permission to do that.",
      code: "FORBIDDEN",
    });
    expect(warn).toHaveBeenCalledWith("authorization.denied", {
      operationId: "contact.update",
      reason: 'Missing permissions: {"contact":["update"]}',
    });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  test("session action answers 401 without running the handler", async () => {
    const handler = vi.fn();
    const action = createSessionAction(sessionOperations.contactsUpdate, handler, {
      db: { transaction: vi.fn() } as never,
      requireAccess: vi.fn(async () => {
        throw new AccessError("UNAUTHENTICATED", "Unauthorized");
      }),
      logger: { warn: vi.fn() },
    });

    const response = (await action()) as Response;

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Please sign in to continue.",
      code: "UNAUTHENTICATED",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  test("session action answers 403 when its handler refuses access", async () => {
    const action = createSessionAction(
      sessionOperations.credentialCreate,
      async () => {
        throw new AccessError("FORBIDDEN", "Cannot grant requested scopes");
      },
      {
        db: { transaction: vi.fn() } as never,
        requireAccess: vi.fn(async () => ({ userId: "user_a", orgId: "org_a", role: "member" })),
        limits: {
          checkSubject: vi.fn(async () => ({ allowed: true })),
        } as never,
      }
    );

    const response = (await action()) as unknown as Response;

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.not.toContain("scopes");
  });

  test("unexpected authorization failures still surface as errors", async () => {
    const route = createSessionRoute(
      sessionOperations.contactsUpdate,
      async () => Response.json({ ok: true }),
      {
        requireAccess: vi.fn(async () => {
          throw new Error("provider outage");
        }),
        logger: { warn: vi.fn() },
      }
    );

    await expect(route()).rejects.toThrow("provider outage");
  });

  test("rejects oversized bodies before auth or DB work", async () => {
    const requireAccess = vi.fn();
    const route = createSessionRoute(
      sessionOperations.contactsUpdate,
      async (_context, _request: Request) => Response.json({ ok: true }),
      { requireAccess, bodyLimitBytes: 8 }
    );

    const response = await route(
      new Request("https://app.example.com/api/contacts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "too large" }),
      })
    );

    expect(response.status).toBe(413);
    expect(requireAccess).not.toHaveBeenCalled();
  });
});
