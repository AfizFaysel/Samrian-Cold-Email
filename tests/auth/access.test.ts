import { beforeEach, describe, expect, test, vi } from "vitest";

import { getAuthProvider } from "../../src/server/auth/provider";
import { AccessError, requireActiveOrg, requireOrgAccess } from "../../src/server/auth/session";

vi.mock("../../src/server/auth/provider", () => ({ getAuthProvider: vi.fn() }));

function provider(overrides: Partial<ReturnType<typeof getAuthProvider>>) {
  vi.mocked(getAuthProvider).mockReturnValue({
    getSession: async () => null,
    getActiveOrg: async () => null,
    hasPermission: async () => false,
    ...overrides,
  });
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    (error: AccessError) => (error instanceof AccessError ? error.code : "other")
  );

describe("access failures", () => {
  beforeEach(() => vi.resetAllMocks());

  test("no session is unauthenticated", async () => {
    provider({});

    await expect(code(requireActiveOrg())).resolves.toBe("UNAUTHENTICATED");
  });

  test("signed in without an active org is forbidden", async () => {
    provider({ getSession: async () => ({ user: { id: "user_a" } }) as never });

    await expect(code(requireActiveOrg())).resolves.toBe("FORBIDDEN");
  });

  test("a denied permission is forbidden", async () => {
    provider({
      getActiveOrg: async () => ({ userId: "user_a", orgId: "org_a", role: "member" }),
    });

    await expect(code(requireOrgAccess(undefined, { contact: ["delete"] }))).resolves.toBe(
      "FORBIDDEN"
    );
  });

  test("a valid context skips the session lookup", async () => {
    const getSession = vi.fn(async () => null);
    provider({
      getSession,
      getActiveOrg: async () => ({ userId: "user_a", orgId: "org_a", role: "owner" }),
    });

    await requireActiveOrg();

    expect(getSession).not.toHaveBeenCalled();
  });
});
