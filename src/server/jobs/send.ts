import type { ContactRecord, MailboxRecord } from "../ports";
import type {
  CampaignSendPayload,
  ConnectorFactory,
  JobRepos,
  JobTransaction,
  SendOptions,
  SendResult,
} from "./types";
import { assessContact } from "../modules/contacts";
import { classifyMailboxError, type MailboxFailureKind } from "../modules/mailboxes";
import { notifySendFailed } from "../modules/notifications";
import { failedEvent, recordEvent, sentEvent } from "../modules/events";
import { applyTracking } from "../modules/tracking";
import { getStepDelayMs, isInSendWindow, nextWindowStart } from "./schedule";
import {
  applyCompliance,
  buildComplianceHeaders,
  buildUnsubscribeUrl,
  resolveListUnsubscribeEnabled,
  type ComplianceSettings,
} from "../modules/compliance";

type CampaignStep = {
  subject?: string;
  body?: string;
};

// These failures prove the provider refused the message. Anything else, such as a dropped
// connection, may have delivered it, so sending again could reach the recipient twice.
const NOT_DELIVERED_FAILURES: ReadonlySet<MailboxFailureKind> = new Set([
  "auth",
  "config",
  "quota",
  "rate-limit",
]);

export type SendCampaignDeps = {
  repos?: JobRepos;
  connectorForMailbox: ConnectorFactory;
  generateUnsubscribeToken(input: {
    contactId: string;
    campaignId: string;
    orgId: string;
  }): Promise<string>;
  appUrl: string;
  now(): number;
  getComplianceSettings?(input: { orgId: string; campaignId: string }): Promise<ComplianceSettings>;
  transaction?: JobTransaction;
};

export type SendCampaignResult =
  | { status: "sent"; messageId: string }
  | { status: "skipped"; reason: "blocked" | "invalid" | "hard-bounced" }
  | { status: "stale"; currentStep: number }
  | { status: "in-progress" }
  | { status: "stopped"; reason: "assignment" | "campaign" | "mailbox" }
  | { status: "deferred"; until: number }
  | { status: "failed"; reason: MailboxFailureKind }
  | { status: "missing"; resource: "campaign" | "contact" | "mailbox" | "assignment" };

export async function sendCampaign(
  payload: CampaignSendPayload,
  deps: SendCampaignDeps
): Promise<SendCampaignResult> {
  const run =
    deps.transaction ??
    ((operation) => {
      if (!deps.repos) throw new Error("Send campaign repositories are not configured");
      return operation(deps.repos);
    });
  const claim = await run((repos) => claimDelivery(repos, payload, deps.now()));
  if (claim.result) return claim.result;
  const { campaign, contact, mailbox } = claim;

  let delivery: Awaited<ReturnType<typeof prepareDelivery>>;
  try {
    delivery = await prepareDelivery(payload, campaign, contact, mailbox, deps, run);
  } catch (error) {
    await run((repos) => repos.mailboxes.unclaimSend(payload.mailboxId, payload.orgId, payload));
    throw error;
  }
  const { connector, rendered, from, message } = delivery;

  try {
    let result: SendResult;
    try {
      result = await connector.send(message);
    } catch (error) {
      const failure = classifyMailboxError(error);
      const notDelivered = NOT_DELIVERED_FAILURES.has(failure.kind);
      await run(async (repos) => {
        if (notDelivered) {
          await repos.mailboxes.unclaimSend(payload.mailboxId, payload.orgId, payload);
        }
        if (notDelivered && !failure.retryable) {
          await repos.mailboxes.releaseReservation?.(payload.mailboxId, payload.orgId, payload);
        }
        await recordEvent(
          failedEvent({
            orgId: payload.orgId,
            campaignId: payload.campaignId,
            contactId: payload.contactId,
            mailboxId: payload.mailboxId,
            assignmentId: payload.assignmentId,
            stepNumber: payload.stepNumber,
            occurredAt: deps.now(),
            reason: error instanceof Error ? error.message : String(error),
          }),
          { events: repos.events }
        );
        await recordMailboxSendFailure(repos, payload, error, deps.now());
        await notifySendFailed(repos.notifications, {
          orgId: payload.orgId,
          campaignId: payload.campaignId,
          contactId: payload.contactId,
          mailboxId: payload.mailboxId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });
      if (notDelivered && !failure.retryable) return { status: "failed", reason: failure.kind };
      throw error;
    }

    const sentAt = deps.now();
    const nextStep = payload.stepNumber + 1;
    const completed = nextStep >= campaign.steps.length;
    return await run(async (repos) => {
      await repos.assignments.advanceStep({
        id: payload.assignmentId,
        orgId: payload.orgId,
        expectedStep: payload.stepNumber,
        mailboxId: payload.mailboxId,
        sentAt,
        completed,
        nextSendAt: completed ? undefined : sentAt + getStepDelayMs(campaign.steps, nextStep),
      });

      await Promise.all([
        repos.mailboxes.incrementSentToday(payload.mailboxId, payload.orgId, payload),
        repos.threads.insert(
          buildSentThread({
            payload,
            mailbox,
            contact,
            rendered,
            result,
            from,
            sentAt,
          })
        ),
        recordEvent(
          sentEvent({
            orgId: payload.orgId,
            campaignId: payload.campaignId,
            contactId: payload.contactId,
            mailboxId: payload.mailboxId,
            assignmentId: payload.assignmentId,
            messageId: result.messageId,
            stepNumber: payload.stepNumber,
            occurredAt: sentAt,
          }),
          { events: repos.events }
        ),
      ]);

      return { status: "sent", messageId: result.messageId } as const;
    });
  } finally {
    await connector.close();
  }
}

// Holds the assignment row while it decides, so a reply committed first stops this send.
async function claimDelivery(repos: JobRepos, payload: CampaignSendPayload, now: number) {
  const assignment = await repos.assignments.lockForSend(payload.assignmentId, payload.orgId);
  const [campaign, contact, mailbox] = await Promise.all([
    repos.campaigns.getById(payload.campaignId, payload.orgId),
    repos.contacts.getById(payload.contactId, payload.orgId),
    repos.mailboxes.getById(payload.mailboxId, payload.orgId),
  ]);
  const stop = async (result: SendCampaignResult) => {
    await repos.mailboxes.releaseReservation?.(payload.mailboxId, payload.orgId, payload);
    return { result };
  };

  if (!campaign) return stop({ status: "missing", resource: "campaign" });
  if (!contact) return stop({ status: "missing", resource: "contact" });
  if (!mailbox) return stop({ status: "missing", resource: "mailbox" });
  if (!assignment) return stop({ status: "missing", resource: "assignment" });
  if (assignment.currentStep !== payload.stepNumber) {
    return stop({ status: "stale", currentStep: assignment.currentStep });
  }
  if (assignment.status !== "active") return stop({ status: "stopped", reason: "assignment" });
  if (campaign.status !== "active") return stop({ status: "stopped", reason: "campaign" });
  if (!canSendFrom(mailbox, now)) return stop({ status: "stopped", reason: "mailbox" });

  const blocked = await repos.blocklist.isBlocked(contact.email, payload.orgId);
  const assessment = await assessContact(contact, { isBlocked: async () => blocked });
  if (assessment.status !== "eligible") {
    return stop({ status: "skipped", reason: toSkipReason(assessment.status) });
  }

  const window = {
    schedule: campaign.schedule as never,
    contactTimezone: contact.timezone,
    now,
  };
  if (!isInSendWindow(window)) {
    const until = nextWindowStart(window);
    await repos.assignments.deferUntil(payload.assignmentId, payload.orgId, until);
    return stop({ status: "deferred", until });
  }

  const claimed = await repos.mailboxes.claimSend(payload.mailboxId, payload.orgId, payload, now);
  if (!claimed) return { result: { status: "in-progress" } as const };
  return { result: null, campaign, contact, mailbox };
}

function canSendFrom(mailbox: MailboxRecord, now: number) {
  return (
    (mailbox.status ?? "active") === "active" &&
    mailbox.rampStatus !== "paused" &&
    (mailbox.providerLimitResetAt ?? 0) <= now
  );
}

async function prepareDelivery(
  payload: CampaignSendPayload,
  campaign: { steps: readonly unknown[]; listUnsubscribeEnabled?: boolean | null },
  contact: ContactRecord,
  mailbox: MailboxRecord,
  deps: SendCampaignDeps,
  run: JobTransaction
) {
  const step = getCampaignStep(campaign.steps, payload.stepNumber);
  const renderedBase = renderEmail(step, contact);
  const unsubscribeToken = await deps.generateUnsubscribeToken({
    contactId: payload.contactId,
    campaignId: payload.campaignId,
    orgId: payload.orgId,
  });
  const compliance = await deps.getComplianceSettings?.({
    orgId: payload.orgId,
    campaignId: payload.campaignId,
  });
  const unsubscribeUrl = buildUnsubscribeUrl({
    appUrl: deps.appUrl,
    contactId: payload.contactId,
    campaignId: payload.campaignId,
    token: unsubscribeToken,
  });
  const enabled = resolveListUnsubscribeEnabled({
    orgEnabled: compliance?.listUnsubscribeEnabled,
    campaignEnabled: campaign.listUnsubscribeEnabled,
  });
  const complianceRendered = applyCompliance({
    enabled,
    rendered: renderedBase,
    unsubscribeUrl,
    footer: compliance?.unsubscribeFooter,
  });
  const rendered = await run((repos) =>
    applyTracking({
      rendered: complianceRendered,
      appUrl: deps.appUrl,
      clickTrackingEnabled: compliance?.clickTrackingEnabled,
      openTrackingEnabled: compliance?.openTrackingEnabled,
      context: {
        orgId: payload.orgId,
        campaignId: payload.campaignId,
        contactId: payload.contactId,
        assignmentId: payload.assignmentId,
        mailboxId: payload.mailboxId,
      },
      events: repos.events,
    })
  );
  const headers = buildComplianceHeaders({
    enabled,
    appUrl: deps.appUrl,
    contactId: payload.contactId,
    campaignId: payload.campaignId,
    token: unsubscribeToken,
    mailto: compliance?.unsubscribeMailto,
  });
  const from = getMailboxFromAddress(mailbox);
  const connector = await deps.connectorForMailbox(mailbox);

  return {
    connector,
    rendered,
    from,
    message: buildSendOptions({ from, to: contact.email, rendered, headers }),
  };
}

async function recordMailboxSendFailure(
  repos: JobRepos,
  payload: CampaignSendPayload,
  error: unknown,
  at: number
) {
  const repo = repos.mailboxes as typeof repos.mailboxes & {
    recordConnectionFailure?: (
      id: string,
      orgId: string,
      failure: ReturnType<typeof classifyMailboxError>,
      at: number
    ) => Promise<void>;
  };
  if (!repo.recordConnectionFailure) return;
  await repo.recordConnectionFailure(
    payload.mailboxId,
    payload.orgId,
    classifyMailboxError(error),
    at
  );
}

export function getCampaignStep(steps: readonly unknown[], stepNumber: number): CampaignStep {
  const step = steps[stepNumber] as CampaignStep | undefined;
  if (!step) throw new Error(`Step configuration not found for step ${stepNumber}`);
  return step;
}

export function renderEmail(step: CampaignStep, contact: ContactRecord) {
  const vars = contact.customVars as Record<string, string>;
  const subject = replaceVariables(parseSpintax(step.subject ?? ""), vars, stripHeaderControls);
  const htmlBody = sanitizeHtmlUrls(
    replaceVariables(parseSpintax(step.body ?? ""), vars, escapeHtml)
  );
  return {
    subject,
    htmlBody,
    textBody: htmlBody.replace(/<[^>]+>/g, ""),
  };
}

export function buildUnsubscribeHeaders(params: {
  appUrl: string;
  contactId: string;
  campaignId: string;
  unsubscribeToken: string;
}) {
  return buildComplianceHeaders({
    enabled: true,
    appUrl: params.appUrl,
    contactId: params.contactId,
    campaignId: params.campaignId,
    token: params.unsubscribeToken,
  });
}

export function buildSendOptions(params: {
  from: string;
  to: string;
  rendered: { subject: string; htmlBody: string; textBody: string };
  headers: Record<string, string>;
}): SendOptions {
  return {
    from: params.from,
    to: params.to,
    subject: params.rendered.subject,
    html: params.rendered.htmlBody,
    text: params.rendered.textBody,
    headers: params.headers,
  };
}

export function getMailboxFromAddress(mailbox: MailboxRecord) {
  return mailbox.email;
}

function buildSentThread(params: {
  payload: CampaignSendPayload;
  mailbox: MailboxRecord;
  contact: ContactRecord;
  rendered: { subject: string; htmlBody: string; textBody: string };
  result: SendResult;
  from: string;
  sentAt: number;
}) {
  return {
    orgId: params.payload.orgId,
    campaignId: params.payload.campaignId,
    contactId: params.payload.contactId,
    mailboxId: params.payload.mailboxId,
    messageId: params.result.messageId,
    direction: "sent" as const,
    from: params.from,
    to: [params.contact.email],
    subject: params.rendered.subject,
    textBody: params.rendered.textBody,
    htmlBody: params.rendered.htmlBody,
    headers: {},
    sentAt: params.sentAt,
  };
}

function toSkipReason(status: "invalid" | "blocked" | "hard-bounced") {
  if (status === "hard-bounced") return "hard-bounced";
  return status;
}

function replaceVariables(
  template: string,
  vars: Record<string, string>,
  transform: (value: string) => string
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => transform(String(vars[key] ?? "")));
}

function parseSpintax(input: string) {
  return input.replace(/\{([^{}|]+\|[^{}]+)\}/g, (_, group: string) => group.split("|")[0] ?? "");
}

function stripHeaderControls(value: string) {
  return value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeHtmlUrls(value: string) {
  return value.replace(
    /\b(href|src)=(["'])(.*?)\2/gi,
    (attribute: string, name: string, quote: string, url: string) => {
      try {
        const parsed = new URL(url);
        return `${name}=${quote}${parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "#"}${quote}`;
      } catch {
        return `${name}=${quote}#${quote}`;
      }
    }
  );
}
