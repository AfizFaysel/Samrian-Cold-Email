"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Rocket, Save } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Page } from "@/components/page-header";
import { Stepper } from "@/components/stepper";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useApi } from "@/hooks/use-api";

// Step components
import { BasicInfoStep } from "./steps/basic-info";
import { ScheduleStep } from "./steps/schedule";
import { EmailSequenceStep } from "./steps/email-sequence";
import { ContactAssignmentStep } from "./steps/contact-assignment";
import { MailboxesStep } from "./steps/mailboxes";
import { ReviewStep } from "./steps/review";
import { requestJson } from "@/lib/request";

const STEPS = [
  { id: 1, name: "Basics", component: BasicInfoStep },
  { id: 2, name: "Schedule", component: ScheduleStep },
  { id: 3, name: "Sequence", component: EmailSequenceStep },
  { id: 4, name: "Contacts", component: ContactAssignmentStep },
  { id: 5, name: "Mailboxes", component: MailboxesStep },
  { id: 6, name: "Review", component: ReviewStep },
] as const;

export type CampaignDraft = {
  id?: string;
  name: string;
  schedule: {
    defaultTimezone: string;
    daysAllowed: string[];
    startTime: string;
    endTime: string;
  };
  steps: Array<{ subject: string; body: string; delayDays?: number; delayHours?: number }>;
  targetGroupId?: string;
  targetContactIds?: string[];
  mailboxIds?: string[];
};

export default function CampaignWizardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");

  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [showLaunchConfirm, setShowLaunchConfirm] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);

  const { data: existingData } = useApi<{ campaign: any | null }>(
    draftId ? `/api/campaigns/${draftId}` : null
  );
  const existingDraft = draftId ? existingData?.campaign : null;

  // Campaign draft state
  const [draft, setDraft] = React.useState<CampaignDraft>({
    name: "",
    schedule: {
      defaultTimezone: "America/New_York",
      daysAllowed: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      startTime: "09:00",
      endTime: "17:00",
    },
    steps: [],
  });

  // Load existing draft data
  React.useEffect(() => {
    if (existingDraft) {
      setDraft({
        id: existingDraft._id ?? existingDraft.id,
        name: existingDraft.name,
        schedule: existingDraft.schedule,
        steps: existingDraft.steps,
        targetGroupId: existingDraft.targetGroupId,
        targetContactIds: existingDraft.targetContactIds,
        mailboxIds: existingDraft.mailboxIds,
      });
    }
  }, [existingDraft]);

  // Auto-save every 30 seconds
  React.useEffect(() => {
    if (!draft.name.trim()) return; // Don't save empty drafts

    const timer = setInterval(async () => {
      await handleSaveDraft();
    }, 30000);

    return () => clearInterval(timer);
  }, [draft]);

  const handleSaveDraft = async () => {
    if (!draft.name.trim()) return;

    setIsSaving(true);
    try {
      const result = await requestJson<{ id: string }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          schedule: draft.schedule,
          steps: draft.steps,
          targetGroupId: draft.targetGroupId,
          targetContactIds: draft.targetContactIds,
          mailboxIds: draft.mailboxIds,
        }),
      });
      const id = result.id;

      if (!draft.id) {
        setDraft((prev) => ({ ...prev, id }));
        // Update URL with draft ID
        router.replace(`/dashboard/campaigns/new/wizard?draft=${id}`);
      }

      setLastSaved(new Date());
    } catch (error: unknown) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    // Save before moving to next step
    await handleSaveDraft();
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleLaunchClick = () => {
    if (!draft.id) {
      toast.error("Please save the campaign first");
      return;
    }
    setShowLaunchConfirm(true);
  };

  const handleLaunchConfirm = async () => {
    if (!draft.id) return;

    setIsLaunching(true);
    try {
      await handleSaveDraft();
      const result = await requestJson<{ status: string; assignmentCount: number }>(
        `/api/campaigns/${draft.id}/launch`,
        {
          method: "POST",
          body: JSON.stringify({ mailboxIds: draft.mailboxIds ?? [] }),
        }
      );
      const verb = result.status === "already-active" ? "already active" : "launched";
      toast.success(`Campaign ${verb} with ${result.assignmentCount} contacts`);
      router.push("/dashboard/campaigns");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to launch campaign");
    } finally {
      setIsLaunching(false);
      setShowLaunchConfirm(false);
    }
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;
  const isLastStep = currentStep === STEPS.length;
  const isFirstStep = currentStep === 1;

  return (
    <Page
      title={draft.name.trim() || "New campaign"}
      breadcrumbs={[
        { label: "Campaigns", href: "/dashboard/campaigns" },
        { label: "New campaign" },
      ]}
      actions={
        <>
          <Text type="supporting" aria-live="polite">
            {isSaving ? "Saving…" : lastSaved ? `Saved ${formatRelativeTime(lastSaved)}` : ""}
          </Text>
          <Button
            label="Save draft"
            variant="secondary"
            icon={<Icon icon={Save} />}
            isDisabled={isSaving || !draft.name.trim()}
            onClick={handleSaveDraft}
          />
        </>
      }
    >
      <Stepper steps={STEPS} current={currentStep} onSelect={setCurrentStep} />

      <VStack minHeight={420}>
        {isLastStep ? (
          <ReviewStep draft={draft} setDraft={setDraft} goToStep={setCurrentStep} />
        ) : (
          <CurrentStepComponent draft={draft} setDraft={setDraft} />
        )}
      </VStack>

      {/* Pinned so Continue stays reachable on long steps. */}
      <HStack
        gap={3}
        hAlign="between"
        vAlign="center"
        className="sticky bottom-0 -mx-4 border-t bg-body/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <Button
          label="Back"
          variant="secondary"
          icon={<Icon icon={ChevronLeft} />}
          isDisabled={isFirstStep}
          onClick={handleBack}
        />
        <Text type="supporting" className="tabular-nums">
          Step {currentStep} of {STEPS.length}
        </Text>
        {isLastStep ? (
          <Button
            label="Launch campaign"
            variant="primary"
            icon={<Icon icon={Rocket} />}
            isLoading={isLaunching}
            isDisabled={!draft.id}
            onClick={handleLaunchClick}
          />
        ) : (
          <Button
            label="Continue"
            variant="primary"
            endContent={<Icon icon={ChevronRight} />}
            onClick={handleNext}
          />
        )}
      </HStack>

      <ConfirmDialog
        isOpen={showLaunchConfirm}
        onOpenChange={setShowLaunchConfirm}
        title="Launch this campaign?"
        description="Emails start sending on the schedule you set. Check the review step before you launch."
        confirmText="Launch campaign"
        isLoading={isLaunching}
        onConfirm={handleLaunchConfirm}
      />
    </Page>
  );
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
