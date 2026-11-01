import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PATCH } from "../../src/app/api/groups/[id]/route";
import { POST } from "../../src/app/api/groups/route";
import { PATCH as PATCH_V1 } from "../../src/app/api/v1/groups/[id]/route";
import { GroupRulesError } from "../../src/server/modules/groups";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionRoute:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args),
}));

vi.mock("../../src/server/api/route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/server/api/route")>()),
  createApiRoute:
    (config: { handler: (input: unknown) => Promise<unknown> }) => (request: Request) =>
      config.handler({ principal: { orgId: "org_1" }, request }),
}));

vi.mock("../../src/server/auth/machine-provider", () => ({
  getMachineCredential: vi.fn(async () => ({})),
}));

vi.mock("../../src/server/db/db", () => ({ getDb: vi.fn(() => ({})) }));

const repo = vi.hoisted(() => ({
  create: vi.fn(async () => ({ id: "group_1", orgId: "org_1" })),
  update: vi.fn(async () => ({ id: "group_1", orgId: "org_1" })),
}));

vi.mock("../../src/server/repos", () => ({
  PostgresGroupRepo: vi.fn(function PostgresGroupRepo() {
    return repo;
  }),
  PostgresIdempotencyStore: vi.fn(),
}));

const request = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/groups", { method, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "group_1" }) };

describe("group routes", () => {
  beforeEach(() => vi.clearAllMocks());

  test("explains rules the module rejects", async () => {
    repo.update.mockRejectedValueOnce(new GroupRulesError(["Dynamic groups need a rule"]));

    const response = await PATCH(request("PATCH", { rules: {} }), params);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Dynamic groups need a rule" });
  });

  test("passes on only the fields that were sent", async () => {
    await PATCH(request("PATCH", { name: "Renamed" }), params);

    expect(repo.update).toHaveBeenCalledWith("group_1", "org_1", { name: "Renamed" });
  });

  test.each([[{ contactIds: "contact_1" }], [{ unknown: true }], ["not an object"]])(
    "rejects %j without writing",
    async (body) => {
      const response = await PATCH(request("PATCH", body), params);

      expect(response.status).toBe(400);
      expect(repo.update).not.toHaveBeenCalled();
    }
  );

  test("creating a group explains rejected rules", async () => {
    repo.create.mockRejectedValueOnce(new GroupRulesError(["Dynamic groups need a rule"]));

    const response = await POST(request("POST", { name: "New", isDynamic: true }));

    expect(response.status).toBe(400);
  });

  test("v1 PATCH does not reset fields left out of the request", async () => {
    await PATCH_V1(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
      }),
      params
    );

    expect(repo.update).toHaveBeenCalledWith("group_1", "org_1", { name: "Renamed" });
  });

  test("v1 reports rejected rules as validation failures", async () => {
    repo.update.mockRejectedValueOnce(new GroupRulesError(["Dynamic groups need a rule"]));

    await expect(
      PATCH_V1(
        new Request("http://localhost", {
          method: "PATCH",
          body: JSON.stringify({ rules: [] }),
        }),
        params
      )
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: 400 });
  });
});
