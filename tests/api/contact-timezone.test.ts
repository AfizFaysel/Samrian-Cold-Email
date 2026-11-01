import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { PATCH } from "../../src/app/api/contacts/route";

vi.mock("../../src/server/api/session-route", () => {
  const route =
    (_operation: unknown, handler: (context: unknown, ...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args);
  return { createSessionRoute: route, createSessionAction: route };
});

const repo = { bulkUpdateTimezone: vi.fn(async () => ({ updated: 1 })) };

vi.mock("../../src/server/repos", () => ({
  PostgresContactRepo: vi.fn(function PostgresContactRepo() {
    return repo;
  }),
}));

const patch = (timezone: string) =>
  PATCH(
    new NextRequest("http://localhost/api/contacts", {
      method: "PATCH",
      body: JSON.stringify({ ids: ["contact_1"], timezone }),
    })
  );

describe("bulk contact timezone", () => {
  beforeEach(() => vi.clearAllMocks());

  test("rejects an invalid timezone without writing", async () => {
    const response = await patch("Mars/Olympus");

    expect(response.status).toBe(400);
    expect(repo.bulkUpdateTimezone).not.toHaveBeenCalled();
  });

  test("updates contacts with a valid timezone", async () => {
    const response = await patch("Africa/Nairobi");

    expect(response.status).toBe(200);
    expect(repo.bulkUpdateTimezone).toHaveBeenCalledWith(["contact_1"], "org_1", "Africa/Nairobi");
  });
});
