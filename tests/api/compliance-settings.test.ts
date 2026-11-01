import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET, PATCH } from "../../src/app/api/settings/compliance/route";

vi.mock("../../src/server/api/session-route", () => ({
  createSessionRoute:
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args),
}));

vi.mock("../../src/server/auth", () => ({
  requireOrgAccess: vi.fn(async () => ({ orgId: "org_1", userId: "user_1", role: "owner" })),
}));

const repo = {
  getCompliance: vi.fn(async () => ({ listUnsubscribeEnabled: false })),
  upsertCompliance: vi.fn(async () => {}),
};

vi.mock("../../src/server/db/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../../src/server/repos", () => ({
  PostgresSettingsRepo: vi.fn(function PostgresSettingsRepo() {
    return repo;
  }),
}));

describe("compliance settings api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns org compliance settings", async () => {
    const response = await GET(new NextRequest("http://localhost/api/settings/compliance"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ listUnsubscribeEnabled: false });
  });

  test("updates org compliance settings", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/settings/compliance", {
        method: "PATCH",
        body: JSON.stringify({
          listUnsubscribeEnabled: true,
          physicalAddress: "1 Main St",
          unsubscribeFooter: "Unsubscribe: {{unsubscribeUrl}}",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(repo.upsertCompliance).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ listUnsubscribeEnabled: true })
    );
  });

  const patch = (body: unknown) =>
    PATCH(
      new NextRequest("http://localhost/api/settings/compliance", {
        method: "PATCH",
        body: JSON.stringify(body),
      })
    );

  test("passes on only the fields that were sent", async () => {
    await patch({ openTrackingEnabled: true });

    expect(repo.upsertCompliance).toHaveBeenCalledWith("org_1", { openTrackingEnabled: true });
  });

  test("treats a blank value as clearing the field and trims the rest", async () => {
    await patch({ physicalAddress: " 1 Main St ", unsubscribeMailto: "  " });

    expect(repo.upsertCompliance).toHaveBeenCalledWith("org_1", {
      physicalAddress: "1 Main St",
      unsubscribeMailto: null,
    });
  });

  test.each([
    [{ bouncePauseRate: 2 }],
    [{ openTrackingEnabled: "yes" }],
    [{ unsubscribeFooter: "No way out" }],
    [{ unknownSetting: true }],
    ["not an object"],
  ])("rejects %j without writing", async (body) => {
    const response = await patch(body);

    expect(response.status).toBe(400);
    expect(repo.upsertCompliance).not.toHaveBeenCalled();
  });
});
