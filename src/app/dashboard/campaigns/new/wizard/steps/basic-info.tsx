import * as React from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import type { CampaignDraft } from "../page";
import { StepIntro } from "./step-intro";

interface BasicInfoStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

export function BasicInfoStep({ draft, setDraft }: BasicInfoStepProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <StepIntro
        title="Name your campaign"
        description="Only your team sees the name. Make it easy to find later."
      />
      <TextInput
        label="Campaign name"
        description="Include the audience and goal, like “Agency partners · demo calls”."
        width="100%"
        value={draft.name}
        onChange={(name) => setDraft((prev) => ({ ...prev, name }))}
        placeholder="Q1 founders outreach"
        hasAutoFocus
        isRequired
      />
    </div>
  );
}
