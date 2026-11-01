import { describe, expect, test, vi } from "vitest";

import { admin, member, owner } from "../../lib/permissions";
import { createBetterAuthProvider } from "../../src/server/auth/better";
import { sessionOperations } from "../../src/server/auth/policy";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

function providerFor(response: { error: null; success: boolean }) {
  const hasPermission = vi.fn(async () => response);
  const auth = { api: { hasPermission } } as unknown as Parameters<
    typeof createBetterAuthProvider
  >[0];
  return { provider: createBetterAuthProvider(auth), hasPermission };
}

const required = Object.values(sessionOperations).flatMap((operation) =>
  operation.access === "permission" ? [operation] : []
);

describe("Better Auth permission adapter", () => {
  test("denies when Better Auth reports success false", async () => {
    const { provider } = providerFor({ error: null, success: false });

    await expect(provider.hasPermission({ contact: ["delete"] })).resolves.toBe(false);
  });

  test("allows when Better Auth reports success true", async () => {
    const { provider, hasPermission } = providerFor({ error: null, success: true });

    await expect(provider.hasPermission({ contact: ["read"] })).resolves.toBe(true);
    expect(hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ body: { permissions: { contact: ["read"] } } })
    );
  });
});

describe("built-in role grants", () => {
  test.each(required)("owner can perform $id", ({ permissions }) => {
    expect(owner.authorize(permissions).success).toBe(true);
  });

  test("admin cannot change settings", () => {
    expect(admin.authorize({ settings: ["update"] }).success).toBe(false);
  });

  test("member cannot delete contacts or connect mailboxes", () => {
    expect(member.authorize({ contact: ["delete"] }).success).toBe(false);
    expect(member.authorize({ mailbox: ["create"] }).success).toBe(false);
  });
});
