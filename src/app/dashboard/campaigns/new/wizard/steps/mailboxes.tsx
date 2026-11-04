import * as React from "react";
import Link from "next/link";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Mailbox } from "lucide-react";
import { EmptyState, RowsSkeleton } from "@/components/page-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import type { CampaignDraft } from "../page";
import { StepIntro } from "./step-intro";

type MailboxItem = {
  _id: string;
  name: string;
  provider: string;
  userEmail?: string;
  username?: string;
  status: "active" | "disconnected" | "limit_reached";
  dailySendLimit: number;
  emailsSentToday: number;
  effectiveDailyLimit: number;
  availableToday: number;
};

type MailboxesStepProps = {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
};

export function MailboxesStep({ draft, setDraft }: MailboxesStepProps) {
  const { data } = useApi<{ mailboxes: MailboxItem[] }>("/api/mailboxes");
  const mailboxes = data?.mailboxes;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StepIntro
        title="Send from"
        description="Sends rotate across these mailboxes and stay inside each one's daily limit."
      />
      {!mailboxes ? (
        <RowsSkeleton rows={3} />
      ) : mailboxes.length === 0 ? (
        <EmptyState
          icon={Mailbox}
          title="No mailboxes connected"
          description="Connect a mailbox before you launch this campaign."
          action={
            <Link href="/dashboard/mailboxes" className={buttonVariants({ variant: "outline" })}>
              Connect a mailbox
            </Link>
          }
        />
      ) : (
        <CheckboxList
          label="Mailboxes"
          value={draft.mailboxIds ?? []}
          onChange={(mailboxIds) => setDraft((current) => ({ ...current, mailboxIds }))}
          hasDividers
        >
          {mailboxes.map((mailbox) => (
            <CheckboxListItem
              key={mailbox._id}
              value={mailbox._id}
              isDisabled={mailbox.status !== "active"}
              label={mailbox.name}
              description={`${mailbox.userEmail ?? mailbox.username ?? "No sender email"} · ${mailbox.availableToday} of ${mailbox.effectiveDailyLimit} left today`}
              endContent={<StatusBadge status={mailbox.status} />}
            />
          ))}
        </CheckboxList>
      )}
    </div>
  );
}
