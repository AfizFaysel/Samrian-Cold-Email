import {
  PostgresAssignmentRepo,
  PostgresBlocklistRepo,
  PostgresCampaignMailboxRepo,
  PostgresCampaignRepo,
  PostgresContactRepo,
  PostgresGroupRepo,
  PostgresMailboxRepo,
  PostgresSettingsRepo,
} from "../repos";
import type { DbExecutor } from "../db/tx";
import type {
  CampaignId,
  CampaignStats,
  CampaignStatus,
  ContactId,
  ContactRecord,
  MailboxId,
  OrgId,
} from "../ports";
import type { CampaignLaunchRecord } from "../repos/campaigns";
import type { CreateCampaignInput } from "../repos/campaigns";
import { campaignStepSchema, isTimezone } from "@samrian/contracts";

import { validateCompliance, type ComplianceSettings } from "./compliance";
import { assessContact } from "./contacts";
import { GROUP_AUDIENCE_LIMIT } from "./groups";

export type LaunchCampaignInput = {
  campaignId: CampaignId;
  orgId: OrgId;
  mailboxIds: MailboxId[];
};

export type SaveCampaignDraftInput = CreateCampaignInput & { mailboxIds?: MailboxId[] };

export class CampaignDraftError extends Error {
  constructor(readonly code: "not-found" | "conflict") {
    super(code === "not-found" ? "Campaign not found" : "Only draft campaigns can be updated");
  }
}

export async function saveCampaignDraft(
  input: SaveCampaignDraftInput,
  deps: {
    campaigns: {
      getLaunch(id: CampaignId, orgId: OrgId): Promise<CampaignLaunchRecord | null>;
      saveDraft(input: CreateCampaignInput): Promise<CampaignId | null>;
    };
    campaignMailboxes: {
      replaceForCampaign(input: {
        campaignId: CampaignId;
        orgId: OrgId;
        mailboxIds: MailboxId[];
      }): Promise<unknown>;
    };
  }
) {
  if (input.id) {
    const existing = await deps.campaigns.getLaunch(input.id, input.orgId);
    if (!existing) throw new CampaignDraftError("not-found");
    if (existing.status !== "draft") throw new CampaignDraftError("conflict");
  }

  const { mailboxIds, ...draft } = input;
  const campaignId = await deps.campaigns.saveDraft(draft);
  if (!campaignId) throw new CampaignDraftError("conflict");
  if (mailboxIds) {
    await deps.campaignMailboxes.replaceForCampaign({ campaignId, orgId: input.orgId, mailboxIds });
  }
  return campaignId;
}

export type LaunchSkippedContacts = {
  blocked: number;
  bounced: number;
  invalid: number;
  missing: number;
};

export type LaunchCampaignResult = {
  status: "launched" | "already-active";
  campaignId: CampaignId;
  assignmentCount: number;
  createdAssignments: number;
  existingAssignments: number;
  linkedMailboxCount: number;
  skippedContacts: LaunchSkippedContacts;
  warnings: string[];
};

export type CampaignLaunchValidation = {
  ready: true;
  eligibleContacts: number;
  linkedMailboxes: number;
  skippedContacts: LaunchSkippedContacts;
  warnings: string[];
};

const NOT_PAUSED = "Only paused campaigns can be resumed";
const WEEK_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Activating and resuming have their own checks, so neither is reachable from a status change.
const STATUS_SOURCES: Partial<Record<string, CampaignStatus[]>> = {
  paused: ["active"],
  completed: ["active", "paused"],
};

export class CampaignStatusError extends Error {
  constructor(readonly code: "not-found" | "conflict" | "unsupported") {
    super(
      code === "not-found"
        ? "Campaign not found"
        : code === "conflict"
          ? "Campaign cannot change to that status from its current status"
          : "Unsupported campaign status"
    );
  }
}

export async function changeCampaignStatus(
  input: { campaignId: CampaignId; orgId: OrgId; status: string },
  deps: {
    campaigns: {
      getLaunch(id: CampaignId, orgId: OrgId): Promise<CampaignLaunchRecord | null>;
      transitionStatus(
        id: CampaignId,
        orgId: OrgId,
        from: CampaignStatus[],
        to: CampaignStatus
      ): Promise<boolean>;
    };
  }
) {
  const from = Object.hasOwn(STATUS_SOURCES, input.status) && STATUS_SOURCES[input.status];
  if (!from) throw new CampaignStatusError("unsupported");

  const moved = await deps.campaigns.transitionStatus(
    input.campaignId,
    input.orgId,
    from,
    input.status as CampaignStatus
  );
  if (moved) return;

  const exists = await deps.campaigns.getLaunch(input.campaignId, input.orgId);
  throw new CampaignStatusError(exists ? "conflict" : "not-found");
}

export class CampaignLaunchError extends Error {
  constructor(
    readonly issues: string[],
    readonly skippedContacts: LaunchSkippedContacts = emptySkipped()
  ) {
    super("Campaign cannot be launched");
  }
}

export type LaunchCampaignDeps = {
  campaigns: {
    getLaunch(id: CampaignId, orgId: OrgId): Promise<CampaignLaunchRecord | null>;
    activateDraft(id: CampaignId, orgId: OrgId): Promise<boolean>;
    resumePaused(id: CampaignId, orgId: OrgId): Promise<boolean>;
    getStats(id: CampaignId, orgId: OrgId): Promise<CampaignStats | null>;
  };
  campaignMailboxes: {
    replaceForCampaign(input: {
      campaignId: CampaignId;
      mailboxIds: MailboxId[];
      orgId: OrgId;
    }): Promise<{ linked: number }>;
    listForCampaign(campaignId: CampaignId, orgId: OrgId): Promise<MailboxId[]>;
  };
  mailboxes: {
    listActiveByIds(ids: MailboxId[], orgId: OrgId): Promise<Array<{ id: MailboxId }>>;
  };
  contacts: {
    listByIds(ids: ContactId[], orgId: OrgId): Promise<ContactRecord[]>;
  };
  groups: {
    getById(
      id: string,
      orgId: OrgId
    ): Promise<{
      id: string;
      isDynamic: boolean;
      contactIds?: string[];
    } | null>;
    resolveContactIds?(id: string, orgId: OrgId, limit?: number): Promise<string[]>;
  };
  blocklist: {
    isBlocked(email: string, orgId: OrgId): Promise<boolean>;
  };
  assignments: {
    createManyForCampaign(input: {
      campaignId: CampaignId;
      contactIds: ContactId[];
      orgId: OrgId;
    }): Promise<{ created: number; existing: number }>;
  };
  compliance?: {
    getSettings(orgId: OrgId, campaignId?: CampaignId): Promise<ComplianceSettings>;
  };
};

export function createCampaignLaunchDeps(db: DbExecutor): LaunchCampaignDeps {
  return {
    campaigns: new PostgresCampaignRepo(db),
    campaignMailboxes: new PostgresCampaignMailboxRepo(db),
    mailboxes: new PostgresMailboxRepo(db),
    contacts: new PostgresContactRepo(db),
    groups: new PostgresGroupRepo(db),
    blocklist: new PostgresBlocklistRepo(db),
    assignments: new PostgresAssignmentRepo(db),
    compliance: new PostgresSettingsRepo(db),
  };
}

export async function launchCampaign(
  input: LaunchCampaignInput,
  deps: LaunchCampaignDeps
): Promise<LaunchCampaignResult> {
  const current = await deps.campaigns.getLaunch(input.campaignId, input.orgId);
  if (current?.status === "active") return alreadyActive(input, deps);

  const prepared = await prepareCampaignLaunch(input, deps);
  const { campaign, mailboxIds, eligibleContactIds, skippedContacts } = prepared;

  // Activating first means only the winner of a race touches the audience and mailboxes.
  if (!(await deps.campaigns.activateDraft(campaign.id, input.orgId))) {
    return alreadyActive(input, deps);
  }

  const linked = await deps.campaignMailboxes.replaceForCampaign({
    campaignId: campaign.id,
    orgId: input.orgId,
    mailboxIds,
  });
  const assignments = await deps.assignments.createManyForCampaign({
    campaignId: campaign.id,
    orgId: input.orgId,
    contactIds: eligibleContactIds,
  });

  return {
    status: "launched",
    campaignId: campaign.id,
    assignmentCount: eligibleContactIds.length,
    createdAssignments: assignments.created,
    existingAssignments: assignments.existing,
    linkedMailboxCount: linked.linked,
    skippedContacts,
    warnings: [],
  };
}

async function alreadyActive(
  input: LaunchCampaignInput,
  deps: LaunchCampaignDeps
): Promise<LaunchCampaignResult> {
  const [stats, linked] = await Promise.all([
    deps.campaigns.getStats(input.campaignId, input.orgId),
    deps.campaignMailboxes.listForCampaign(input.campaignId, input.orgId),
  ]);
  return {
    status: "already-active",
    campaignId: input.campaignId,
    assignmentCount: stats?.total ?? 0,
    createdAssignments: 0,
    existingAssignments: stats?.total ?? 0,
    linkedMailboxCount: linked.length,
    skippedContacts: emptySkipped(),
    warnings: [],
  };
}

// Resuming keeps the launched audience and mailboxes, so it rechecks only what sending needs.
export async function resumeCampaign(
  input: { campaignId: CampaignId; orgId: OrgId },
  deps: Pick<LaunchCampaignDeps, "campaigns" | "campaignMailboxes" | "mailboxes" | "compliance">
) {
  const campaign = await deps.campaigns.getLaunch(input.campaignId, input.orgId);
  if (!campaign) throw new CampaignLaunchError(["Campaign not found"]);
  if (campaign.status !== "paused") throw new CampaignLaunchError([NOT_PAUSED]);

  const issues = validateCampaign(campaign);
  if (deps.compliance) {
    issues.push(...validateCompliance(await deps.compliance.getSettings(input.orgId, campaign.id)));
  }
  const linked = await deps.campaignMailboxes.listForCampaign(campaign.id, input.orgId);
  const active = await deps.mailboxes.listActiveByIds(linked, input.orgId);
  if (active.length === 0) issues.push("Campaign needs at least one active mailbox");
  if (issues.length > 0) throw new CampaignLaunchError(issues);

  if (!(await deps.campaigns.resumePaused(campaign.id, input.orgId))) {
    throw new CampaignLaunchError([NOT_PAUSED]);
  }
  return { status: "resumed" as const, campaignId: campaign.id };
}

export async function validateCampaignLaunch(
  input: LaunchCampaignInput,
  deps: LaunchCampaignDeps
): Promise<CampaignLaunchValidation> {
  const prepared = await prepareCampaignLaunch(input, deps);
  return {
    ready: true,
    eligibleContacts: prepared.eligibleContactIds.length,
    linkedMailboxes: prepared.mailboxIds.length,
    skippedContacts: prepared.skippedContacts,
    warnings: [],
  };
}

async function prepareCampaignLaunch(input: LaunchCampaignInput, deps: LaunchCampaignDeps) {
  const campaign = await deps.campaigns.getLaunch(input.campaignId, input.orgId);
  if (!campaign) {
    throw new CampaignLaunchError(["Campaign not found"]);
  }

  if (campaign.status !== "draft" && campaign.status !== "active") {
    throw new CampaignLaunchError([`Campaign cannot launch from ${campaign.status ?? "unknown"}`]);
  }

  const campaignIssues = validateCampaign(campaign);
  if (deps.compliance) {
    campaignIssues.push(
      ...validateCompliance(await deps.compliance.getSettings(input.orgId, campaign.id))
    );
  }
  if (campaignIssues.length > 0) {
    throw new CampaignLaunchError(campaignIssues);
  }

  const mailboxIds = Array.from(new Set(input.mailboxIds));
  if (mailboxIds.length === 0) {
    throw new CampaignLaunchError(["Select at least one active mailbox"]);
  }

  const activeMailboxes = await deps.mailboxes.listActiveByIds(mailboxIds, input.orgId);
  if (activeMailboxes.length !== mailboxIds.length) {
    throw new CampaignLaunchError(["Select at least one active mailbox"]);
  }

  const targetContactIds = await resolveTargetContactIds(campaign, input.orgId, deps);
  const { eligibleContactIds, skippedContacts } = await resolveEligibleContacts(
    targetContactIds,
    input.orgId,
    deps
  );

  if (eligibleContactIds.length === 0) {
    throw new CampaignLaunchError(["Campaign has no eligible contacts"], skippedContacts);
  }

  return { campaign, mailboxIds, eligibleContactIds, skippedContacts };
}

async function resolveTargetContactIds(
  campaign: CampaignLaunchRecord,
  orgId: OrgId,
  deps: LaunchCampaignDeps
): Promise<ContactId[]> {
  if (campaign.targetContactIds && campaign.targetContactIds.length > 0) {
    return Array.from(new Set(campaign.targetContactIds));
  }

  if (!campaign.targetGroupId) {
    throw new CampaignLaunchError(["Campaign has no target contacts"]);
  }

  const group = await deps.groups.getById(campaign.targetGroupId, orgId);
  if (!group) {
    throw new CampaignLaunchError(["Campaign target group not found"]);
  }
  if (group.isDynamic) {
    if (!deps.groups.resolveContactIds) {
      throw new CampaignLaunchError(["Dynamic group launch is not supported yet"]);
    }
    const contactIds = await deps.groups.resolveContactIds(group.id, orgId);
    if (contactIds.length > GROUP_AUDIENCE_LIMIT) {
      throw new CampaignLaunchError([
        `Campaign audience is over the limit of ${GROUP_AUDIENCE_LIMIT} contacts`,
      ]);
    }
    return Array.from(new Set(contactIds));
  }
  return Array.from(new Set(group.contactIds ?? []));
}

async function resolveEligibleContacts(
  contactIds: ContactId[],
  orgId: OrgId,
  deps: LaunchCampaignDeps
): Promise<{ eligibleContactIds: ContactId[]; skippedContacts: LaunchSkippedContacts }> {
  const contacts = await deps.contacts.listByIds(contactIds, orgId);
  const foundById = new Map(contacts.map((contact) => [contact.id, contact]));
  const skippedContacts = emptySkipped();
  skippedContacts.missing = contactIds.filter((id) => !foundById.has(id)).length;

  const eligibleContactIds: ContactId[] = [];
  for (const contact of contacts) {
    const assessment = await assessContact(contact, {
      isBlocked: (email, contactOrgId) => deps.blocklist.isBlocked(email, contactOrgId),
    });
    if (assessment.status === "hard-bounced") {
      skippedContacts.bounced += 1;
      continue;
    }
    if (assessment.status === "blocked") {
      skippedContacts.blocked += 1;
      continue;
    }
    if (assessment.status === "invalid") {
      skippedContacts.invalid += 1;
      continue;
    }
    eligibleContactIds.push(contact.id);
  }

  return { eligibleContactIds, skippedContacts };
}

function emptySkipped(): LaunchSkippedContacts {
  return { blocked: 0, bounced: 0, invalid: 0, missing: 0 };
}

function validateCampaign(campaign: CampaignLaunchRecord): string[] {
  const issues: string[] = [];
  if (!campaign.name.trim()) issues.push("Campaign name is required");
  if (campaign.steps.length === 0) issues.push("Add at least one email step");
  issues.push(...validateSteps(campaign.steps));
  if (!hasUsableSchedule(campaign.schedule)) {
    issues.push("Campaign schedule must include send days and a valid time window");
  }
  if (!hasValidTimezones(campaign.schedule)) issues.push("Campaign timezone is invalid");
  if (
    !campaign.targetGroupId &&
    (!campaign.targetContactIds || campaign.targetContactIds.length === 0)
  ) {
    issues.push("Campaign has no target contacts");
  }
  return issues;
}

function validateSteps(steps: readonly unknown[]): string[] {
  return steps.flatMap((step, index) => {
    const label = `Step ${index + 1}`;
    const parsed = campaignStepSchema.safeParse(step);
    if (!parsed.success) return [`${label} is invalid`];
    return [
      ...(parsed.data.subject?.trim() ? [] : [`${label} needs a subject`]),
      ...(parsed.data.body?.trim() ? [] : [`${label} needs a body`]),
    ];
  });
}

function hasValidTimezones(schedule: Record<string, unknown>): boolean {
  return [schedule.timezone, schedule.defaultTimezone].every(
    (value) => value == null || (typeof value === "string" && isTimezone(value))
  );
}

function hasUsableSchedule(schedule: Record<string, unknown>): boolean {
  const daysAllowed = schedule.daysAllowed;
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;
  return (
    Array.isArray(daysAllowed) &&
    daysAllowed.length > 0 &&
    daysAllowed.every((day) => WEEK_DAYS.has(String(day).toLowerCase())) &&
    typeof startTime === "string" &&
    CLOCK_TIME.test(startTime) &&
    typeof endTime === "string" &&
    CLOCK_TIME.test(endTime) &&
    startTime < endTime
  );
}
