import { beforeEach, describe, expect, test, vi } from "vitest";

import { POST } from "../../src/app/api/campaigns/[id]/resume/route";
import { CampaignLaunchError, resumeCampaign } from "../../src/server/modules/campaigns";

const access = vi.hoisted(() => ({ operation: undefined as unknown }));

vi.mock("../../src/server/api/session-route", () => ({
  createSessionRoute: (
    operation: unknown,
    handler: (context: unknown, ...args: unknown[]) => Promise<unknown>
  ) => {
    access.operation = operation;
    return (...args: unknown[]) =>
      handler({ orgId: "org_1", userId: "user_1", role: "owner", db: {} }, ...args);
  },
}));

vi.mock("../../src/server/modules/campaigns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/server/modules/campaigns")>()),
  createCampaignLaunchDeps: vi.fn(() => ({})),
  resumeCampaign: vi.fn(),
}));

const resume = () =>
  POST(new Request("http://localhost/api/campaigns/campaign_1/resume", { method: "POST" }), {
    params: Promise.resolve({ id: "campaign_1" }),
  });

describe("campaign resume route", () => {
  beforeEach(() => vi.clearAllMocks());

  test("requires the same permission as launch because it starts sending", () => {
    expect(access.operation).toMatchObject({ permissions: { campaign: ["launch"] } });
  });

  test("resumes the campaign in the caller's organization", async () => {
    vi.mocked(resumeCampaign).mockResolvedValue({ status: "resumed", campaignId: "campaign_1" });

    const response = await resume();

    expect(response.status).toBe(200);
    expect(resumeCampaign).toHaveBeenCalledWith({ campaignId: "campaign_1", orgId: "org_1" }, {});
  });

  test("explains why a campaign cannot resume", async () => {
    vi.mocked(resumeCampaign).mockRejectedValue(
      new CampaignLaunchError(["Physical mailing address is required", "No mailbox"])
    );

    const response = await resume();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Physical mailing address is required. No mailbox",
      issues: ["Physical mailing address is required", "No mailbox"],
    });
  });
});
