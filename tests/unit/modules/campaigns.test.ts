import { describe, expect, test, vi } from "vitest";

import {
  changeCampaignStatus,
  launchCampaign,
  resumeCampaign,
  saveCampaignDraft,
  validateCampaignLaunch,
} from "../../../src/server/modules/campaigns";
import type { ContactRecord } from "../../../src/server/ports";

describe("campaign status changes", () => {
  const change = (
    status: string,
    campaigns: Parameters<typeof changeCampaignStatus>[1]["campaigns"]
  ) => changeCampaignStatus({ campaignId: "campaign_1", orgId: "org_1", status }, { campaigns });
  const repo = (moved: boolean, existing: object | null = { status: "active" }) => ({
    transitionStatus: vi.fn(async () => moved),
    getLaunch: vi.fn(async () => existing as never),
  });

  test.each([
    ["paused", ["active"]],
    ["completed", ["active", "paused"]],
  ])("allows %s only from %j", async (status, from) => {
    const campaigns = repo(true);

    await change(status, campaigns);

    expect(campaigns.transitionStatus).toHaveBeenCalledWith("campaign_1", "org_1", from, status);
  });

  test.each(["draft", "active", "archived"])("refuses to set %s here", async (status) => {
    const campaigns = repo(true);

    await expect(change(status, campaigns)).rejects.toMatchObject({ code: "unsupported" });
    expect(campaigns.transitionStatus).not.toHaveBeenCalled();
  });

  test("reports a conflict when the campaign is in the wrong state", async () => {
    await expect(change("paused", repo(false))).rejects.toMatchObject({ code: "conflict" });
  });

  test("reports a missing campaign", async () => {
    await expect(change("paused", repo(false, null))).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("what a campaign may send", () => {
  const launch = (input: Parameters<typeof createDeps>[0]) =>
    launchCampaign(
      { campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] },
      createDeps(input)
    );
  const schedule = { daysAllowed: ["monday"], startTime: "09:00", endTime: "17:00" };

  test.each([
    [[null], "Step 1 is invalid"],
    [[{}], "Step 1 needs a subject"],
    [[{ subject: "  ", body: "Hi" }], "Step 1 needs a subject"],
    [[{ subject: "Hi", body: " " }], "Step 1 needs a body"],
    [[{ subject: "Hi", body: "Yo" }, { subject: "Next" }], "Step 2 needs a body"],
    [[{ subject: "Hi", body: "Yo", delayDays: -1 }], "Step 1 is invalid"],
    [[{ subject: "Hi", body: "Yo", delayHours: "soon" }], "Step 1 is invalid"],
  ])("rejects steps %j", async (steps, issue) => {
    await expect(launch({ steps: steps as never })).rejects.toMatchObject({
      issues: expect.arrayContaining([issue]),
    });
  });

  test.each([
    [{ ...schedule, startTime: "25:00", endTime: "26:00" }],
    [{ ...schedule, startTime: "09:60" }],
    [{ ...schedule, daysAllowed: ["someday"] }],
    [{ ...schedule, daysAllowed: "monday" }],
    [{ ...schedule, startTime: "17:00", endTime: "09:00" }],
  ])("rejects the schedule %j", async (input) => {
    await expect(launch({ schedule: input })).rejects.toMatchObject({
      issues: ["Campaign schedule must include send days and a valid time window"],
    });
  });

  test.each(["timezone", "defaultTimezone"])("rejects an invalid %s", async (field) => {
    await expect(launch({ schedule: { ...schedule, [field]: "Mars/Base" } })).rejects.toMatchObject(
      { issues: ["Campaign timezone is invalid"] }
    );
  });

  test("accepts capitalized days, which dispatch treats the same", async () => {
    await expect(
      launch({ schedule: { ...schedule, daysAllowed: ["Monday"] } })
    ).resolves.toMatchObject({ status: "launched" });
  });

  test("refuses an audience over the limit instead of quietly cutting it", async () => {
    const contacts = Array.from({ length: 10_001 }, (_, index) => ({
      id: `contact_${index}`,
      orgId: "org_1",
      email: `c${index}@example.com`,
      customVars: {},
    }));

    await expect(
      launch({ targetContactIds: null, targetGroupId: "group_1", dynamicGroup: true, contacts })
    ).rejects.toMatchObject({
      issues: ["Campaign audience is over the limit of 10000 contacts"],
    });
  });
});

describe("campaign resume", () => {
  const input = { campaignId: "campaign_1", orgId: "org_1" };

  test("reactivates a paused campaign without touching its audience or mailboxes", async () => {
    const deps = createDeps({ status: "paused" });
    const replace = vi.spyOn(deps.campaignMailboxes, "replaceForCampaign");
    const assign = vi.spyOn(deps.assignments, "createManyForCampaign");

    await expect(resumeCampaign(input, deps)).resolves.toEqual({
      status: "resumed",
      campaignId: "campaign_1",
    });

    expect(deps.campaigns.status).toBe("active");
    expect(replace).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  test.each(["draft", "active", "completed"] as const)("refuses a %s campaign", async (status) => {
    await expect(resumeCampaign(input, createDeps({ status }))).rejects.toMatchObject({
      issues: ["Only paused campaigns can be resumed"],
    });
  });

  test("refuses when another request resumed it first", async () => {
    const deps = createDeps({ status: "paused" });
    deps.campaigns.resumePaused = async () => false;

    await expect(resumeCampaign(input, deps)).rejects.toMatchObject({
      issues: ["Only paused campaigns can be resumed"],
    });
  });

  test("reports a missing campaign", async () => {
    await expect(
      resumeCampaign(input, createDeps({ missingCampaign: true }))
    ).rejects.toMatchObject({ issues: ["Campaign not found"] });
  });

  test("stays paused until compliance and a mailbox are in place", async () => {
    const deps = createDeps({ status: "paused", compliance: {}, mailboxes: [] });

    await expect(resumeCampaign(input, deps)).rejects.toMatchObject({
      issues: [
        "Physical mailing address is required",
        "Campaign needs at least one active mailbox",
      ],
    });
    expect(deps.campaigns.status).toBe("paused");
  });
});

describe("campaign launch module", () => {
  test("saves campaign draft and mailbox links through one module", async () => {
    const campaigns = { getLaunch: vi.fn(), saveDraft: vi.fn().mockResolvedValue("campaign_1") };
    const campaignMailboxes = { replaceForCampaign: vi.fn() };

    await expect(
      saveCampaignDraft(
        {
          orgId: "org_1",
          name: "Outbound",
          schedule: {},
          steps: [{}],
          mailboxIds: ["mailbox_1"],
        },
        { campaigns, campaignMailboxes }
      )
    ).resolves.toBe("campaign_1");
    expect(campaignMailboxes.replaceForCampaign).toHaveBeenCalledWith({
      campaignId: "campaign_1",
      orgId: "org_1",
      mailboxIds: ["mailbox_1"],
    });
  });

  test("rejects updates to non-draft campaigns before write", async () => {
    const campaigns = {
      getLaunch: vi.fn().mockResolvedValue({ status: "active" }),
      saveDraft: vi.fn(),
    };

    await expect(
      saveCampaignDraft(
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Outbound",
          schedule: {},
          steps: [{}],
        },
        { campaigns, campaignMailboxes: { replaceForCampaign: vi.fn() } }
      )
    ).rejects.toMatchObject({ code: "conflict" });
    expect(campaigns.saveDraft).not.toHaveBeenCalled();
  });

  test("validates launch readiness without writing campaign state", async () => {
    const deps = createDeps();

    await expect(
      validateCampaignLaunch(
        { campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] },
        deps
      )
    ).resolves.toMatchObject({ ready: true, eligibleContacts: 2, linkedMailboxes: 1 });
    expect(deps.campaigns.status).toBe("draft");
  });

  test("launches a draft campaign by validating mailboxes and materializing assignments", async () => {
    const deps = createDeps();

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      campaignId: "campaign_1",
      assignmentCount: 2,
      createdAssignments: 2,
      existingAssignments: 0,
      linkedMailboxCount: 1,
      skippedContacts: { blocked: 0, bounced: 0, missing: 0 },
    });
    expect(deps.campaigns.status).toBe("active");
  });

  test("rejects launch with no active mailbox", async () => {
    const deps = createDeps({ mailboxes: [] });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: [] }, deps)
    ).rejects.toMatchObject({
      issues: ["Select at least one active mailbox"],
    });
  });

  test("rejects wrong-org campaign as not found", async () => {
    const deps = createDeps({ missingCampaign: true });

    await expect(
      launchCampaign(
        { campaignId: "campaign_1", orgId: "org_other", mailboxIds: ["mailbox_1"] },
        deps
      )
    ).rejects.toMatchObject({
      issues: ["Campaign not found"],
    });
  });

  test("rejects launch without name, email step, or usable schedule", async () => {
    const deps = createDeps({ name: "", steps: [], schedule: { daysAllowed: [] } });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: [
        "Campaign name is required",
        "Add at least one email step",
        "Campaign schedule must include send days and a valid time window",
      ],
    });
  });

  test("skips blocked and hard-bounced contacts, then fails when no eligible contacts remain", async () => {
    const deps = createDeps({
      contacts: [
        { id: "contact_1", orgId: "org_1", email: "blocked@example.com", customVars: {} },
        {
          id: "contact_2",
          orgId: "org_1",
          email: "bounced@example.com",
          customVars: {},
          bounceStatus: "hard",
        },
      ],
      blocked: new Set(["blocked@example.com"]),
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: ["Campaign has no eligible contacts"],
      skippedContacts: { blocked: 1, bounced: 1, missing: 0 },
    });
  });

  test("launching an active campaign reports it and changes nothing", async () => {
    const deps = createDeps({ status: "active", existingAssignments: 2 });
    const replace = vi.spyOn(deps.campaignMailboxes, "replaceForCampaign");
    const assign = vi.spyOn(deps.assignments, "createManyForCampaign");

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_2"] }, deps)
    ).resolves.toMatchObject({
      status: "already-active",
      assignmentCount: 2,
      createdAssignments: 0,
      existingAssignments: 2,
      linkedMailboxCount: 1,
    });

    expect(replace).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  test("losing a launch race changes nothing", async () => {
    const deps = createDeps({ status: "draft" });
    deps.campaigns.activateDraft = async () => false;
    const replace = vi.spyOn(deps.campaignMailboxes, "replaceForCampaign");

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({ status: "already-active" });

    expect(replace).not.toHaveBeenCalled();
  });

  test("a draft save that loses to a launch is a conflict", async () => {
    const campaigns = {
      getLaunch: vi.fn().mockResolvedValue({ status: "draft" }),
      saveDraft: vi.fn().mockResolvedValue(null),
    };
    const campaignMailboxes = { replaceForCampaign: vi.fn() };

    await expect(
      saveCampaignDraft(
        {
          id: "campaign_1",
          orgId: "org_1",
          name: "Outbound",
          schedule: {},
          steps: [],
          mailboxIds: ["mailbox_1"],
        },
        { campaigns, campaignMailboxes }
      )
    ).rejects.toMatchObject({ code: "conflict" });

    expect(campaignMailboxes.replaceForCampaign).not.toHaveBeenCalled();
  });

  test("launches a dynamic group by resolving matching contacts", async () => {
    const deps = createDeps({
      targetContactIds: null,
      targetGroupId: "group_1",
      dynamicGroup: true,
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      assignmentCount: 2,
    });
  });

  test("launches a static group by materializing its contacts", async () => {
    const deps = createDeps({ targetContactIds: null, targetGroupId: "group_1" });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).resolves.toMatchObject({
      status: "launched",
      assignmentCount: 2,
    });
  });

  test("requires a physical address even when List-Unsubscribe is disabled", async () => {
    const deps = createDeps({
      compliance: {
        listUnsubscribeEnabled: false,
      },
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({ issues: ["Physical mailing address is required"] });
  });

  test("requires a usable opt-out and address when List-Unsubscribe is enabled", async () => {
    const deps = createDeps({
      compliance: {
        listUnsubscribeEnabled: true,
        physicalAddress: "",
        unsubscribeFooter: "Opt out",
      },
    });

    await expect(
      launchCampaign({ campaignId: "campaign_1", orgId: "org_1", mailboxIds: ["mailbox_1"] }, deps)
    ).rejects.toMatchObject({
      issues: [
        "Physical mailing address is required",
        "Unsubscribe footer must include {{unsubscribeUrl}}",
      ],
    });
  });
});

function createDeps(input?: {
  status?: "draft" | "active" | "paused" | "completed";
  mailboxes?: string[];
  contacts?: ContactRecord[];
  blocked?: Set<string>;
  existingAssignments?: number;
  name?: string;
  steps?: unknown[];
  schedule?: Record<string, unknown>;
  missingCampaign?: boolean;
  targetContactIds?: string[] | null;
  targetGroupId?: string;
  dynamicGroup?: boolean;
  compliance?: {
    listUnsubscribeEnabled?: boolean;
    physicalAddress?: string;
    unsubscribeFooter?: string;
  };
}) {
  const contacts = input?.contacts ?? [
    { id: "contact_1", orgId: "org_1", email: "ada@example.com", customVars: {} },
    { id: "contact_2", orgId: "org_1", email: "grace@example.com", customVars: {} },
  ];
  const deps = {
    campaigns: {
      status: input?.status ?? "draft",
      async getLaunch(id: string, orgId: string) {
        if (input?.missingCampaign) return null;
        return {
          id,
          orgId,
          name: input?.name ?? "Launch",
          status: this.status,
          steps: input?.steps ?? [{ subject: "Hello", body: "Hi" }],
          schedule: input?.schedule ?? {
            daysAllowed: ["monday"],
            startTime: "09:00",
            endTime: "17:00",
          },
          targetContactIds:
            input?.targetContactIds === null
              ? undefined
              : (input?.targetContactIds ?? contacts.map((contact) => contact.id)),
          targetGroupId: input?.targetGroupId,
        };
      },
      async activateDraft() {
        if (this.status !== "draft") return false;
        this.status = "active";
        return true;
      },
      async getStats() {
        return {
          campaignId: "campaign_1",
          total: input?.existingAssignments ?? 0,
          bounced: 0,
        };
      },
      async resumePaused() {
        if (this.status !== "paused") return false;
        this.status = "active";
        return true;
      },
    },
    campaignMailboxes: {
      async replaceForCampaign() {
        return { linked: input?.mailboxes?.length ?? 1 };
      },
      async listForCampaign() {
        return input?.mailboxes ?? ["mailbox_1"];
      },
    },
    mailboxes: {
      async listActiveByIds(ids: string[]) {
        const available = input?.mailboxes ?? ["mailbox_1"];
        return ids.filter((id) => available.includes(id)).map((id) => ({ id, orgId: "org_1" }));
      },
    },
    contacts: {
      async listByIds(ids: string[]) {
        return contacts.filter((contact) => ids.includes(contact.id));
      },
    },
    groups: {
      async getById() {
        return {
          id: "group_1",
          orgId: "org_1",
          name: "Group",
          rules: {},
          logic: "AND" as const,
          isDynamic: input?.dynamicGroup ?? false,
          contactIds: contacts.map((contact) => contact.id),
        };
      },
      async resolveContactIds() {
        return contacts.map((contact) => contact.id);
      },
    },
    blocklist: {
      async isBlocked(email: string) {
        return input?.blocked?.has(email) ?? false;
      },
    },
    assignments: {
      async createManyForCampaign(params: { contactIds: string[] }) {
        return {
          created: Math.max(params.contactIds.length - (input?.existingAssignments ?? 0), 0),
          existing: input?.existingAssignments ?? 0,
        };
      },
    },
    compliance: {
      async getSettings() {
        return input?.compliance ?? { physicalAddress: "1 Main St" };
      },
    },
  };
  return deps;
}
