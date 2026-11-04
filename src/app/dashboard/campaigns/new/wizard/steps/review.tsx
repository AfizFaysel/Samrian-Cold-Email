import * as React from "react";
import type { CampaignDraft } from "../page";
import { CheckCircle2, AlertCircle, Mail, Clock, Users, Calendar, Send } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface ReviewStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

type MailboxCapacity = {
  _id: string;
  availableToday: number;
};

export function ReviewStep({ draft }: ReviewStepProps) {
  const { data: groupData } = useApi<{ group: any | null; count: number }>(
    draft.targetGroupId ? `/api/groups/${draft.targetGroupId}` : "/api/groups/__none__"
  );
  const { data: mailboxData } = useApi<{ mailboxes: MailboxCapacity[] }>("/api/mailboxes");
  const contactGroup = draft.targetGroupId ? groupData?.group : null;
  const groupContactCount = draft.targetGroupId ? groupData?.count : 0;

  // Validation checks
  const validations = [
    {
      label: "Campaign name set",
      valid: draft.name.trim().length > 0,
    },
    {
      label: "Schedule configured",
      valid: draft.schedule.daysAllowed.length > 0,
    },
    {
      label: "At least one email step",
      valid: draft.steps.length > 0,
    },
    {
      label: "Contacts assigned",
      valid: !!draft.targetGroupId || (draft.targetContactIds && draft.targetContactIds.length > 0),
    },
    {
      label: "At least one mailbox selected",
      valid: (draft.mailboxIds?.length ?? 0) > 0,
    },
  ];

  const allValid = validations.every((v) => v.valid);
  const targetCount = draft.targetGroupId
    ? (groupContactCount ?? 0)
    : (draft.targetContactIds?.length ?? 0);
  const selectedMailboxIds = new Set(draft.mailboxIds ?? []);
  const availableToday = (mailboxData?.mailboxes ?? [])
    .filter((mailbox) => selectedMailboxIds.has(mailbox._id))
    .reduce((total, mailbox) => total + mailbox.availableToday, 0);
  const capacityKnown = mailboxData !== undefined;
  const capacityShortfall = capacityKnown && targetCount > availableToday;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-primary">Review & Launch</h2>
        <p className="mt-2 text-base text-secondary">
          Review your campaign settings before launching.
        </p>
      </div>

      <div className="space-y-6">
        {/* Validation Status */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-medium text-primary">Validation Checks</h3>
          <div className="space-y-3">
            {validations.map((validation, index) => (
              <div key={index} className="flex items-center gap-3">
                {validation.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-warning" />
                )}
                <span
                  className={`text-base ${validation.valid ? "text-secondary" : "text-warning font-medium"}`}
                >
                  {validation.label}
                </span>
              </div>
            ))}
          </div>
          {!allValid && (
            <div className="mt-4 rounded-md border border-warning/30 bg-warning-muted p-4">
              <p className="text-base text-warning">
                Please complete all required steps before launching.
              </p>
            </div>
          )}
        </div>

        {/* Campaign Summary */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-4 text-base font-medium text-primary">Campaign Summary</h3>
          <div className="space-y-4">
            {/* Name */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted">
                <Mail className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Campaign Name</p>
                <p className="mt-1 font-medium text-primary">{draft.name || "—"}</p>
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted">
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Schedule</p>
                <p className="mt-1 text-base text-primary">
                  {draft.schedule.daysAllowed.length > 0
                    ? `${draft.schedule.daysAllowed.map((d) => d.slice(0, 3)).join(", ")}`
                    : "—"}
                </p>
                <p className="text-base text-secondary">
                  {draft.schedule.startTime} - {draft.schedule.endTime} (
                  {draft.schedule.defaultTimezone})
                </p>
              </div>
            </div>

            {/* Email Steps */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Email Sequence</p>
                <p className="mt-1 font-medium text-primary">
                  {draft.steps.length} step{draft.steps.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Target Contacts */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted">
                <Users className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Target Audience</p>
                {draft.targetGroupId ? (
                  <>
                    <p className="mt-1 font-medium text-primary">
                      {contactGroup?.name || "Loading..."}
                    </p>
                    <p className="text-base text-secondary">
                      {targetCount} contact{targetCount !== 1 ? "s" : ""}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 font-medium text-primary">
                    {targetCount} specific contact{targetCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Sending Mailboxes */}
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted">
                <Send className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-secondary">Sending Mailboxes</p>
                <p className="mt-1 font-medium text-primary">
                  {draft.mailboxIds?.length ?? 0} selected
                </p>
                {capacityKnown && (
                  <p className="text-base text-secondary">{availableToday} sends available today</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {capacityShortfall && (
          <div className="rounded-md border border-warning/30 bg-warning-muted p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-none text-warning" />
              <p className="text-base leading-6 text-warning">
                Selected mailboxes have {availableToday} sends available today for {targetCount}{" "}
                contacts. Remaining sends will stay queued for later send windows.
              </p>
            </div>
          </div>
        )}

        {/* Email Steps Preview */}
        {draft.steps.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-4 text-base font-medium text-primary">Email Sequence Preview</h3>
            <div className="space-y-4">
              {draft.steps.map((step, index) => (
                <div key={index} className="rounded-md border border-border bg-muted p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-bg text-sm font-medium text-on-accent">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-secondary">Step {index + 1}</span>
                  </div>
                  <p className="mb-1 text-base font-medium text-primary">{step.subject}</p>
                  <p className="line-clamp-2 text-sm text-secondary">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Launch Warning */}
        {allValid && (
          <div className="rounded-lg border border-success/30 bg-success-muted p-6">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-muted">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-medium text-success">Ready to Launch</h3>
                <p className="text-base leading-relaxed text-success/70">
                  Your campaign is configured and ready. Click "Launch Campaign" below to activate
                  it. Emails will be sent according to your schedule.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
