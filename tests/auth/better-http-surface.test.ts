import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAuthOptions } from "../../src/server/auth/better";

const origin = "http://app.test";
const email = "owner@example.com";
const password = "correct-horse-battery";

function createAuth() {
  const tables = Object.fromEntries(
    [
      "user",
      "session",
      "account",
      "verification",
      "organization",
      "member",
      "invitation",
      "organizationRole",
      "apikey",
    ].map((name) => [name, []])
  );
  return betterAuth(createAuthOptions({ database: memoryAdapter(tables) }));
}

type Auth = ReturnType<typeof createAuth>;

function post(auth: Auth, path: string, cookie?: string, body: unknown = {}) {
  return auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}

async function signedInOwner(auth: Auth) {
  const response = await post(auth, "/sign-up/email", undefined, {
    email,
    password,
    name: "Owner",
  });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie });
  const organization = await auth.api.createOrganization({
    headers,
    body: { name: "Acme", slug: "acme" },
  });
  return { cookie, headers, organizationId: organization!.id };
}

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-test-secret-test-secret");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  vi.stubEnv("GOOGLE_CLIENT_ID", "");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("Better Auth HTTP surface", () => {
  test.each([
    "/organization/update-member-role",
    "/organization/invite-member",
    "/organization/remove-member",
    "/organization/create-role",
    "/organization/update-role",
    "/organization/delete-role",
    "/organization/update",
    "/organization/delete",
    "/api-key/create",
    "/api-key/update",
    "/api-key/delete",
  ])("%s is closed to a signed-in owner", async (path) => {
    const auth = createAuth();
    const { cookie, organizationId } = await signedInOwner(auth);

    const response = await post(auth, path, cookie, { organizationId });

    expect(response.status).toBe(404);
  });

  test("the sign-in and organization flows the app uses stay open", async () => {
    const auth = createAuth();
    const { cookie, organizationId } = await signedInOwner(auth);

    const signIn = await post(auth, "/sign-in/email", undefined, { email, password });
    const setActive = await post(auth, "/organization/set-active", cookie, { organizationId });
    const create = await post(auth, "/organization/create", cookie, {
      name: "Second",
      slug: "second",
    });

    expect([signIn.status, setActive.status, create.status]).toEqual([200, 200, 200]);
  });

  test("guarded server code can still manage roles in process", async () => {
    const auth = createAuth();
    const { headers, organizationId } = await signedInOwner(auth);

    const created = await auth.api.createOrgRole({
      headers,
      body: { organizationId, role: "support", permission: { contact: ["read"] } },
    });

    expect(created.success).toBe(true);
  });
});
