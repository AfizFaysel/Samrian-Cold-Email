import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { authorizeOAuthMailbox, OAuthTargetError } from "../../lib/oauth-helpers";
import { createOAuthState, validateOAuthState } from "../../lib/oauth-state";
import { GET as googleCallback } from "../../src/app/api/auth/google/callback/route";
import { GET as googleStart } from "../../src/app/api/auth/google/route";
import { GET as microsoftCallback } from "../../src/app/api/auth/microsoft/callback/route";
import { GET as microsoftStart } from "../../src/app/api/auth/microsoft/route";
import { AccessError, requireActiveOrg, requireOrgAccess } from "../../src/server/auth";

vi.mock("@/server/limits/http", () => ({
  withPublicLimit: (request: Request, _id: string, handler: (r: Request) => Promise<Response>) =>
    handler(request),
}));
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("../../src/server/auth")>()),
  requireActiveOrg: vi.fn(),
  requireOrgAccess: vi.fn(),
}));

const context = { userId: "user_a", orgId: "org_a", role: "member" };
const denied = () => new AccessError("FORBIDDEN", "Missing permissions");
const app = "http://app.test";

const providers = [
  { provider: "google", start: googleStart, callback: googleCallback },
  { provider: "microsoft", start: microsoftStart, callback: microsoftCallback },
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", app);
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
  for (const prefix of ["GOOGLE", "MICROSOFT"]) {
    vi.stubEnv(`${prefix}_CLIENT_ID`, "client");
    vi.stubEnv(`${prefix}_CLIENT_SECRET`, "secret");
  }
  vi.mocked(requireActiveOrg).mockResolvedValue(context);
  vi.mocked(requireOrgAccess).mockResolvedValue(context);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each(providers)("$provider mailbox OAuth access", ({ provider, start, callback }) => {
  test("starting a connection requires mailbox create", async () => {
    vi.mocked(requireOrgAccess).mockRejectedValue(denied());

    const response = await start(new NextRequest(`${app}/api/auth/${provider}`));

    expect(requireOrgAccess).toHaveBeenCalledWith(undefined, { mailbox: ["create"] });
    expect(response.headers.get("location")).toBe(`${app}/dashboard/mailboxes?error=forbidden`);
  });

  test("starting a reconnect requires mailbox update", async () => {
    vi.mocked(requireOrgAccess).mockRejectedValue(denied());

    const response = await start(new NextRequest(`${app}/api/auth/${provider}?mailboxId=mbx_1`));

    expect(requireOrgAccess).toHaveBeenCalledWith(undefined, { mailbox: ["update"] });
    expect(response.headers.get("location")).toBe(`${app}/dashboard/mailboxes?error=forbidden`);
  });

  test("a signed-out visitor is sent to sign in", async () => {
    vi.mocked(requireOrgAccess).mockRejectedValue(new AccessError("UNAUTHENTICATED", "No session"));

    const response = await start(new NextRequest(`${app}/api/auth/${provider}`));

    expect(response.headers.get("location")).toBe(`${app}/sign-in?error=unauthenticated`);
  });

  test("an allowed connection continues to the provider", async () => {
    const response = await start(new NextRequest(`${app}/api/auth/${provider}`));

    expect(response.headers.get("location")).toMatch(/^https:\/\/(accounts\.google|login\.micro)/);
  });

  test("the callback denies before exchanging the code", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const state = createOAuthState("org_a", "user_a");
    vi.mocked(requireOrgAccess).mockRejectedValue(denied());

    const response = await callback(
      new NextRequest(`${app}/api/auth/${provider}/callback?code=abc&state=${state}`, {
        headers: { cookie: `${provider}_oauth_state=${state}` },
      })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(`${app}/dashboard/mailboxes?error=forbidden`);
  });
});

describe("reconnect target", () => {
  const requireAccess = async () => context;

  test("a new connection does not look up a mailbox", async () => {
    const findMailbox = vi.fn();

    await expect(
      authorizeOAuthMailbox("google", undefined, { requireAccess, findMailbox })
    ).resolves.toBe(context);
    expect(findMailbox).not.toHaveBeenCalled();
  });

  test("accepts a live mailbox from the same provider", async () => {
    const findMailbox = vi.fn(async () => ({ provider: "google" }));

    await expect(
      authorizeOAuthMailbox("google", "mbx_1", { requireAccess, findMailbox })
    ).resolves.toBe(context);
    expect(findMailbox).toHaveBeenCalledWith("mbx_1", "org_a");
  });

  test("rejects a mailbox missing from this org", async () => {
    await expect(
      authorizeOAuthMailbox("google", "mbx_foreign", {
        requireAccess,
        findMailbox: async () => null,
      })
    ).rejects.toEqual(new OAuthTargetError("mailbox_not_found"));
  });

  test("rejects a mailbox from another provider", async () => {
    await expect(
      authorizeOAuthMailbox("google", "mbx_1", {
        requireAccess,
        findMailbox: async () => ({ provider: "microsoft" }),
      })
    ).rejects.toEqual(new OAuthTargetError("mailbox_provider_mismatch"));
  });
});

describe("OAuth state", () => {
  test("rejects a state whose mailbox was changed after signing", () => {
    const state = createOAuthState("org_a", "user_a", "mbx_1");
    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const forged = Buffer.from(JSON.stringify({ ...payload, m: "mbx_2" })).toString("base64url");

    expect(() => validateOAuthState(forged, "org_a", "user_a")).toThrow();
  });
});
