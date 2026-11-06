import * as React from "react";
import type { CampaignDraft } from "../page";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { List, ListItem } from "@astryxdesign/core/List";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Text } from "@astryxdesign/core/Text";
import { Panel } from "@/components/page-header";
import { useApi } from "@/hooks/use-api";
import { formatDelay } from "./email-sequence";
import { StepIntro } from "./step-intro";

interface ReviewStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
  goToStep?: (step: number) => void;
}

type Issue = { label: string; step?: number; href?: string };

type MailboxCapacity = {
  _id: string;
  availableToday: number;
};

export function ReviewStep({ draft, goToStep }: ReviewStepProps) {
  const { data: groupData } = useApi<{ group: any | null; count: number }>(
    draft.targetGroupId ? `/api/groups/${draft.targetGroupId}` : null
  );
  const { data: mailboxData } = useApi<{ mailboxes: MailboxCapacity[] }>("/api/mailboxes");
  const { data: compliance } = useApi<{ physicalAddress?: string | null }>(
    "/api/settings/compliance"
  );
  const contactGroup = draft.targetGroupId ? groupData?.group : null;
  const groupContactCount = draft.targetGroupId ? groupData?.count : 0;

  const incompleteSteps = draft.steps.flatMap((step, index) =>
    step.subject.trim() && step.body.trim() ? [] : [index + 1]
  );

  // Each launch blocker names where it gets fixed: a wizard step, or Settings.
  const issues = (
    [
      !draft.name.trim() && { label: "Name the campaign", step: 1 },
      draft.schedule.daysAllowed.length === 0 && {
        label: "Pick at least one sending day",
        step: 2,
      },
      draft.steps.length === 0 && { label: "Write at least one email", step: 3 },
      incompleteSteps.length > 0 && {
        label: `Add a subject and body to ${incompleteSteps.length === 1 ? "step" : "steps"} ${new Intl.ListFormat("en").format(incompleteSteps.map(String))}`,
        step: 3,
      },
      !draft.targetGroupId &&
        !draft.targetContactIds?.length && { label: "Choose who gets it", step: 4 },
      !draft.mailboxIds?.length && { label: "Pick at least one mailbox", step: 5 },
      compliance !== undefined &&
        !compliance?.physicalAddress?.trim() && {
          label: "Add your mailing address in Settings",
          href: "/dashboard/settings",
        },
    ] as Array<Issue | false>
  ).filter((issue): issue is Issue => !!issue);

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

      {issues.length > 0 ? (
        <Banner
          status="warning"
          title={`Fix ${issues.length === 1 ? "1 thing" : `${issues.length} things`} to launch`}
          collapsible={false}
        >
          <List hasDividers edge="flush" density="compact">
            {issues.map((issue) => (
              <ListItem
                key={issue.label}
                label={issue.label}
                endContent={
                  <Button
                    label={issue.href ? "Open Settings" : "Fix"}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      issue.href
                        ? window.location.assign(issue.href)
                        : issue.step && goToStep?.(issue.step)
                    }
                  />
                }
              />
            ))}
          </List>
        </Banner>
      ) : capacityShortfall ? (
        // Nothing blocks launch, so no "ready" banner: the Launch button says that. Only a
        // shortfall is worth a note, since it changes when the last emails go out.
        <Banner
          status="info"
          title="Some emails go out after today"
          description={`Selected mailboxes have ${availableToday} sends available today for ${targetCount} contacts. The rest go out in later send windows.`}
        />
      ) : null}

      <Panel title="Summary" bodyClassName="p-4">
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
      </Panel>

      {draft.steps.length > 0 && (
        <Panel title="Sequence">
          <List hasDividers listStyle="decimal">
            {draft.steps.map((step, index) => (
              <ListItem
                key={index}
                align="first-line"
                label={step.subject || "No subject"}
                description={
                  <Text type="supporting" maxLines={2}>
                    {step.body || "No body"}
                  </Text>
                }
                endContent={
                  <Text type="supporting">{index === 0 ? "Sends first" : formatDelay(step)}</Text>
                }
              />
            ))}
          </List>
        </Panel>
      )}
    </div>
  );
}
