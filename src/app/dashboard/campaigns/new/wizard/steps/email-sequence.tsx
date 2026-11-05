import * as React from "react";
import type { CampaignDraft } from "../page";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Panel } from "@/components/page-header";
import { EmptyState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { StepIntro } from "./step-intro";

interface EmailSequenceStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

// Matches the worker's default when a step has no delay (src/server/jobs/schedule.ts).
const DEFAULT_DELAY_DAYS = 3;

const VARIABLES = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
];

export function EmailSequenceStep({ draft, setDraft }: EmailSequenceStepProps) {
  const [activeStepIndex, setActiveStepIndex] = React.useState(0);
  const [previewContactIndex, setPreviewContactIndex] = React.useState(0);

  const { data: contacts } = useApi<{ contacts: any[] }>("/api/contacts?limit=10");
  const previewContacts = contacts?.contacts || [];

  const activeStep = draft.steps[activeStepIndex];

  const addStep = () => {
    setDraft((prev) => ({
      ...prev,
      steps: [...prev.steps, { subject: "", body: "" }],
    }));
    setActiveStepIndex(draft.steps.length);
  };

  const removeStep = (index: number) => {
    if (draft.steps.length === 1) return;
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
    if (activeStepIndex >= draft.steps.length - 1) {
      setActiveStepIndex(Math.max(0, draft.steps.length - 2));
    }
  };

  const updateDelay = (index: number, field: "delayDays" | "delayHours", value: number) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    }));
  };

  const updateStep = (index: number, field: "subject" | "body", value: string) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((step, i) => (i === index ? { ...step, [field]: value } : step)),
    }));
  };

  const insertVariable = (varKey: string) => {
    if (!activeStep) return;
    const variable = `{{${varKey}}}`;
    // Insert at cursor position in body
    updateStep(activeStepIndex, "body", activeStep.body + variable);
  };

  // Validate spintax (basic check)
  const validateSpintax = (text: string) => {
    const openBraces = (text.match(/{/g) || []).length;
    const closeBraces = (text.match(/}/g) || []).length;
    return openBraces === closeBraces;
  };

  const renderPreview = () => {
    if (!activeStep || previewContacts.length === 0) {
      return (
        <Text type="supporting">
          {activeStep ? "Add a contact to preview this step." : "Add a step to preview it."}
        </Text>
      );
    }

    const contact = previewContacts[previewContactIndex];
    let subject = activeStep.subject;
    let body = activeStep.body;

    // Replace variables
    VARIABLES.forEach((v) => {
      const value = contact.customVars?.[v.key] || contact.email;
      subject = subject.replace(new RegExp(`{{${v.key}}}`, "g"), value);
      body = body.replace(new RegExp(`{{${v.key}}}`, "g"), value);
    });

    // Simple spintax handling (pick first option)
    subject = subject.replace(/{([^}]+)}/g, (_, options) => options.split("|")[0]);
    body = body.replace(/{([^}]+)}/g, (_, options) => options.split("|")[0]);

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5 border-b pb-3">
          <Text type="supporting">To {contact.email}</Text>
          <span className="font-semibold">{subject || "No subject"}</span>
        </div>
        <p className="text-base whitespace-pre-wrap">{body}</p>
      </div>
    );
  };

  const subjectValid = activeStep ? validateSpintax(activeStep.subject) : true;
  const bodyValid = activeStep ? validateSpintax(activeStep.body) : true;

  const spintaxOk = subjectValid && bodyValid;

  return (
    <div className="flex flex-col gap-6">
      <StepIntro
        title="Write the sequence"
        description="Each step goes out after the one before. Replies stop the sequence for that contact."
      />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <nav aria-label="Sequence steps" className="flex flex-col gap-1">
          {draft.steps.map((step, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveStepIndex(index)}
              aria-current={activeStepIndex === index ? "step" : undefined}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted",
                activeStepIndex === index && "bg-muted"
              )}
            >
              <Mail className="mt-0.5 size-4 shrink-0 text-secondary" />
              <span className="flex min-w-0 flex-col">
                <span className="text-base font-medium">Step {index + 1}</span>
                <span className="truncate text-sm text-secondary">
                  {step.subject || "No subject"}
                </span>
                {index > 0 && <Text type="supporting">{formatDelay(step)}</Text>}
              </span>
            </button>
          ))}
          <Button variant="ghost" className="justify-start" onClick={addStep}>
            <Plus data-icon="inline-start" />
            Add step
          </Button>
        </nav>

        {activeStep ? (
          <div className="flex min-w-0 flex-col gap-5">
            <HStack gap={3} hAlign="between" vAlign="center">
              <Heading level={3}>Step {activeStepIndex + 1}</Heading>
              {draft.steps.length > 1 && (
                <AstryxButton
                  label="Delete step"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={Trash2} />}
                  onClick={() => removeStep(activeStepIndex)}
                />
              )}
            </HStack>

            {activeStepIndex > 0 && (
              <HStack gap={3} wrap="wrap">
                <NumberInput
                  label="Wait days"
                  description="After the previous step"
                  value={activeStep.delayDays ?? DEFAULT_DELAY_DAYS}
                  onChange={(value) => updateDelay(activeStepIndex, "delayDays", value)}
                  min={0}
                  max={60}
                  hasNumberSteppers
                  isWheelEnabled={false}
                />
                <NumberInput
                  label="Wait hours"
                  description="Added to the days"
                  value={activeStep.delayHours ?? 0}
                  onChange={(value) => updateDelay(activeStepIndex, "delayHours", value)}
                  min={0}
                  max={23}
                  hasNumberSteppers
                  isWheelEnabled={false}
                />
              </HStack>
            )}

            <VStack gap={2}>
              <Text type="label">Merge fields</Text>
              <HStack gap={1.5} wrap="wrap">
                {VARIABLES.map((v) => (
                  <AstryxButton
                    key={v.key}
                    label={`{{${v.key}}}`}
                    variant="secondary"
                    size="sm"
                    tooltip={`Add ${v.label} to the end of the body`}
                    onClick={() => insertVariable(v.key)}
                  />
                ))}
              </HStack>
              <Text type="supporting">
                Vary wording with spintax: {"{Hi|Hello|Hey}"}. Fields are added to the end of the
                body.
              </Text>
            </VStack>

            <TextInput
              label="Subject"
              width="100%"
              value={activeStep.subject}
              onChange={(value) => updateStep(activeStepIndex, "subject", value)}
              placeholder="Quick question about {{company}}"
              status={subjectValid ? undefined : { type: "warning" }}
            />

            <VStack gap={2}>
              <TextArea
                label="Body"
                width="100%"
                value={activeStep.body}
                onChange={(value) => updateStep(activeStepIndex, "body", value)}
                placeholder={"Hi {{firstName}},\n\nI noticed {{company}} is…"}
                rows={12}
                status={bodyValid ? undefined : { type: "warning" }}
              />
              <HStack gap={1.5} vAlign="center">
                <Icon
                  icon={spintaxOk ? "success" : "warning"}
                  color={spintaxOk ? "success" : "warning"}
                  size="sm"
                />
                <Text type="supporting">
                  {spintaxOk ? "Spintax is balanced" : "Spintax has an unclosed { or }"}
                </Text>
              </HStack>
            </VStack>
          </div>
        ) : (
          <EmptyState
            icon={Mail}
            title="No steps yet"
            description="Add the first email of the sequence."
          />
        )}

        <Panel title="Preview" className="self-start lg:sticky lg:top-6">
          <div className="flex flex-col gap-4 p-4">
            {previewContacts.length > 0 && (
              <Selector
                label="Preview as"
                width="100%"
                value={String(previewContactIndex)}
                onChange={(value) => setPreviewContactIndex(Number(value))}
                options={previewContacts.map((contact: any, index: number) => ({
                  value: String(index),
                  label: contact.customVars?.name || contact.email,
                }))}
              />
            )}
            {renderPreview()}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function formatDelay(step: { delayDays?: number; delayHours?: number }) {
  const days = step.delayDays ?? DEFAULT_DELAY_DAYS;
  const hours = step.delayHours ?? 0;
  const parts = [days > 0 && `${days}d`, hours > 0 && `${hours}h`].filter(Boolean);
  return parts.length ? `Waits ${parts.join(" ")}` : "Sends right after the previous step";
}
