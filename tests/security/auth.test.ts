import { describe, expect, test, vi } from "vitest";

import { createApiRoute } from "../../src/server/api/route";
import { createSessionRoute } from "../../src/server/api/session-route";
import { sessionOperations } from "../../src/server/auth/policy";
import { AccessError } from "../../src/server/auth/session";
import { apiRequest, credential } from "./request";

describe("authentication boundaries", () => {
  test("session route rejects unauthenticated requests before handler", async () => {
    const handler = vi.fn();
    const route = createSessionRoute(sessionOperations.contactsList, handler, {
      requireAccess: async () => {
        throw new AccessError("UNAUTHENTICATED", "Unauthorized");
      },
    });
    const response = (await route()) as Response;
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  test("session route denies a missing permission before handler", async () => {
    const handler = vi.fn();
    const route = createSessionRoute(sessionOperations.contactDelete, handler, {
      requireAccess: async () => {
        throw new AccessError("FORBIDDEN", 'Missing permissions: {"contact":["delete"]}');
      },
    });
    const response = (await route()) as Response;
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("contact");
    expect(handler).not.toHaveBeenCalled();
  });

  test("API route rejects missing and invalid bearer credentials", async () => {
    const route = createApiRoute({
      operation: "identity.me",
      credentials: credential(null),
      handler: async () => ({ data: {} }),
      tenant: async (_context, operation) => operation(undefined as never),
    });
    expect((await route(apiRequest("/api/v1/me"))).status).toBe(401);
    expect((await route(apiRequest("/api/v1/me", { token: "invalid" }))).status).toBe(401);
  });
});
