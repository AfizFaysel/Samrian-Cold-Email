import * as React from "react";
import type { CampaignDraft } from "../page";
import { Banner } from "@astryxdesign/core/Banner";
import { Icon } from "@astryxdesign/core/Icon";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Text } from "@astryxdesign/core/Text";
import { Panel } from "@/components/page-header";
import { useApi } from "@/hooks/use-api";
import { StepIntro } from "./step-intro";

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
    draft.targetGroupId ? `/api/groups/${draft.targetGroupId}` : null
  );
  const { data: mailboxData } = useApi<{ mailboxes: MailboxCapacity[] }>("/api/mailboxes");
  const contactGroup = draft.targetGroupId ? groupData?.group : null;
  const groupContactCount = draft.targetGroupId ? groupData?.count : 0;

  // Validation checks
  const validations = [
    {
      label: "Campaign has a name",
      valid: draft.name.trim().length > 0,
    },
    {
      label: "At least one sending day",
      valid: draft.schedule.daysAllowed.length > 0,
    },
    {
      label: "At least one email",
      valid: draft.steps.length > 0,
    },
    {
      label: "Recipients chosen",
      valid: !!draft.targetGroupId || (draft.targetContactIds && draft.targetContactIds.length > 0),
    },
    {
      label: "At least one mailbox",
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

  const days = draft.schedule.daysAllowed.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StepIntro
        title="Review and launch"
        description="Check everything once. You can pause a campaign at any time."
      />

      {allValid ? (
        <Banner
          status="success"
          title="Ready to launch"
          description="Emails start on the schedule below."
        />
      ) : (
        <Banner
          status="warning"
          title="A few things are missing"
          description="Finish the steps marked below to launch."
        />
      )}

      {capacityShortfall && (
        <Banner
          status="warning"
          title="Not everyone can be emailed today"
          description={`Selected mailboxes have ${availableToday} sends available today for ${targetCount} contacts. The rest stay queued for later send windows.`}
        />
      )}

      <Panel title="Checklist">
        <ul className="flex flex-col gap-2 p-4">
          {validations.map((validation) => (
            <li key={validation.label} className="flex items-center gap-2">
              <Icon
                icon={validation.valid ? "success" : "warning"}
                color={validation.valid ? "success" : "warning"}
                size="sm"
              />
              <span className="text-base">{validation.label}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Summary">
        <div className="p-4">
          <MetadataList>
            <MetadataListItem label="Name">{draft.name || "—"}</MetadataListItem>
            <MetadataListItem label="Days">{days.length ? days.join(", ") : "—"}</MetadataListItem>
            <MetadataListItem label="Window">
              {draft.schedule.startTime}–{draft.schedule.endTime} · {draft.schedule.defaultTimezone}
            </MetadataListItem>
            <MetadataListItem label="Emails">
              {draft.steps.length} step{draft.steps.length !== 1 ? "s" : ""}
            </MetadataListItem>
            <MetadataListItem label="Recipients">
              {draft.targetGroupId
                ? `${contactGroup?.name ?? "Group"} · ${targetCount} contact${targetCount !== 1 ? "s" : ""}`
                : `${targetCount} contact${targetCount !== 1 ? "s" : ""}`}
            </MetadataListItem>
            <MetadataListItem label="Mailboxes">
              {draft.mailboxIds?.length ?? 0} selected
              {capacityKnown ? ` · ${availableToday} sends available today` : ""}
            </MetadataListItem>
          </MetadataList>
        </div>
      </Panel>

      {draft.steps.length > 0 && (
        <Panel title="Sequence">
          <ol className="divide-y">
            {draft.steps.map((step, index) => (
              <li key={index} className="flex flex-col gap-0.5 px-4 py-3">
                <Text type="supporting">Step {index + 1}</Text>
                <span className="text-base font-medium">{step.subject || "No subject"}</span>
                <span className="line-clamp-2 text-sm text-secondary">{step.body}</span>
              </li>
            ))}
          </ol>
        </Panel>
      )}
    </div>
  );
}
