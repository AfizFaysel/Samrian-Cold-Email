import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { DELETE, POST } from "../../src/app/api/blocklist/route";
import { DELETE as DELETE_V1 } from "../../src/app/api/v1/blocklist/[id]/route";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionRoute:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args),
}));

vi.mock("../../src/server/api/route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/server/api/route")>()),
  createApiRoute: (config: { handler: (input: unknown) => Promise<unknown> }) => () =>
    config.handler({ principal: { orgId: "org_1" } }),
}));

vi.mock("../../src/server/auth/machine-provider", () => ({
  getMachineCredential: vi.fn(async () => ({})),
}));

vi.mock("../../src/server/db/db", () => ({ getDb: vi.fn(() => ({})) }));

const repo = {
  add: vi.fn(async () => {}),
  remove: vi.fn(async () => "removed"),
  removeById: vi.fn(async () => "removed"),
};

vi.mock("../../src/server/repos", () => ({
  PostgresBlocklistRepo: vi.fn(function PostgresBlocklistRepo() {
    return repo;
  }),
  PostgresIdempotencyStore: vi.fn(),
}));

const request = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/blocklist", { method, body: JSON.stringify(body) });

describe("blocklist routes", () => {
  beforeEach(() => vi.clearAllMocks());

  test("adds a trimmed manual entry", async () => {
    const response = await POST(request("POST", { email: "  person@example.com " }));

    expect(response.status).toBe(200);
    expect(repo.add).toHaveBeenCalledWith({
      orgId: "org_1",
      email: "person@example.com",
      reason: "manual",
    });
  });

  test("rejects a value that is not an email", async () => {
    const response = await POST(request("POST", { email: "not an email" }));

    expect(response.status).toBe(400);
    expect(repo.add).not.toHaveBeenCalled();
  });

  test("answers 409 when asked to remove an opt-out", async () => {
    repo.remove.mockResolvedValueOnce("opt-out");

    const response = await DELETE(request("DELETE", { email: "person@example.com" }));

    expect(response.status).toBe(409);
  });

  test("reports whether a manual entry was removed", async () => {
    const response = await DELETE(request("DELETE", { email: "person@example.com" }));

    await expect(response.json()).resolves.toEqual({ success: true });
  });

  describe("v1", () => {
    const remove = () =>
      DELETE_V1(new Request("http://localhost/api/v1/blocklist/block_1"), {
        params: Promise.resolve({ id: "block_1" }),
      }) as unknown as Promise<{ data: unknown }>;

    test("refuses to remove an opt-out", async () => {
      repo.removeById.mockResolvedValueOnce("opt-out");

      await expect(remove()).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    });

    test("reports a missing entry", async () => {
      repo.removeById.mockResolvedValueOnce("missing");

      await expect(remove()).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    });

    test("removes a manual entry", async () => {
      await expect(remove()).resolves.toEqual({ data: { removed: true } });
    });
  });
});
