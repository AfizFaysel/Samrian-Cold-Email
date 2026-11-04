import * as React from "react";
import { Text } from "@astryxdesign/core/Text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="campaign-name">Campaign name</Label>
        <Input
          id="campaign-name"
          value={draft.name}
          onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Q1 founders outreach"
          maxLength={200}
        />
        <Text type="supporting">
          Include the audience and goal, like “Agency partners · demo calls”.
        </Text>
      </div>
    </div>
  );
}
