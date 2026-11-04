import * as React from "react";
import { Mail, AlertCircle } from "lucide-react";
import type { CampaignDraft } from "../page";
import { useApi } from "@/hooks/use-api";

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
  const selected = new Set(draft.mailboxIds ?? []);

  const toggleMailbox = (id: string) => {
    setDraft((current) => {
      const next = new Set(current.mailboxIds ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...current, mailboxIds: Array.from(next) };
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-primary">Select Mailboxes</h2>
        <p className="mt-2 text-base text-secondary">
          Choose active sending accounts for this campaign.
        </p>
      </div>

      {!mailboxes ? (
        <div className="rounded-lg border border-border bg-card p-6 text-base text-secondary">
          Loading mailboxes...
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning-muted p-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-base text-warning">
              Connect an email account before launching a campaign.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {mailboxes.map((mailbox) => {
            const active = mailbox.status === "active";
            const checked = selected.has(mailbox._id);
            return (
              <button
                key={mailbox._id}
                type="button"
                disabled={!active}
                onClick={() => toggleMailbox(mailbox._id)}
                className={`w-full rounded-md border-2 p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  checked
                    ? "border-accent bg-accent-muted"
                    : "border-border bg-card hover:border-accent/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      checked ? "bg-accent-bg text-on-accent" : "bg-muted text-secondary"
                    }`}
                  >
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-primary">{mailbox.name}</h3>
                      <span className="text-sm font-medium text-secondary">{mailbox.status}</span>
                    </div>
                    <p className="mt-1 text-base text-secondary">
                      {mailbox.userEmail ?? mailbox.username ?? "No sender email"}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                      {mailbox.availableToday} available today · {mailbox.emailsSentToday}/
                      {mailbox.effectiveDailyLimit} used
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
