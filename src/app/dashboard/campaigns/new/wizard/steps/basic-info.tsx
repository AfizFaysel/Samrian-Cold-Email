import * as React from "react";
import type { CampaignDraft } from "../page";

interface BasicInfoStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

export function BasicInfoStep({ draft, setDraft }: BasicInfoStepProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-primary">Campaign Details</h2>
        <p className="mt-2 text-base text-secondary">
          Give your campaign a name and description to help you identify it later.
        </p>
      </div>

      <div className="space-y-6">
        {/* Campaign Name */}
        <div>
          <label className="mb-2 block text-base font-medium text-primary">
            Campaign Name <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Q1 Outbound Sales Campaign"
            className="w-full rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
            maxLength={200}
          />
          <p className="mt-1 text-sm text-secondary">{draft.name.length}/200 characters</p>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border border-accent/15 bg-accent-muted/30 p-6">
          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-muted">
              <svg
                className="h-5 w-5 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="mb-1 text-base font-medium text-accent">Pro Tip</h3>
              <p className="text-base leading-relaxed text-accent/70">
                Use descriptive names that include the target audience and goal. For example:
                "Enterprise SaaS - Product Demo Requests" or "Recruitment - Senior Engineers Q1
                2024".
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
