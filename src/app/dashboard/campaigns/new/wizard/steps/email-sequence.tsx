import * as React from "react";
import type { CampaignDraft } from "../page";
import { Plus, Trash2, Mail, Eye, AlertCircle, CheckCircle2 } from "lucide-react";
import { useApi } from "@/hooks/use-api";

interface EmailSequenceStepProps {
  draft: CampaignDraft;
  setDraft: React.Dispatch<React.SetStateAction<CampaignDraft>>;
}

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
    if (draft.steps.length === 1) {
      alert("Campaign must have at least one step");
      return;
    }
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
    if (activeStepIndex >= draft.steps.length - 1) {
      setActiveStepIndex(Math.max(0, draft.steps.length - 2));
    }
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
      return <p className="text-base text-secondary">No preview available</p>;
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
      <div className="rounded-md border border-border bg-card p-4">
        <div className="mb-4 border-b border-border pb-4">
          <p className="text-sm text-secondary">From: you@company.com</p>
          <p className="text-sm text-secondary">To: {contact.email}</p>
          <p className="mt-2 font-semibold text-primary">{subject}</p>
        </div>
        <div className="whitespace-pre-wrap text-base text-primary">{body}</div>
      </div>
    );
  };

  const subjectValid = activeStep ? validateSpintax(activeStep.subject) : true;
  const bodyValid = activeStep ? validateSpintax(activeStep.body) : true;

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Left: Timeline */}
      <div className="col-span-3">
        <h3 className="mb-4 text-base font-medium text-primary">Sequence Timeline</h3>
        <div className="relative space-y-4">
          {/* Vertical line */}
          <div className="absolute left-4 top-8 bottom-8 w-0.5 bg-muted" />

          {draft.steps.map((step, index) => (
            <button
              key={index}
              onClick={() => setActiveStepIndex(index)}
              className={`relative w-full rounded-md border-2 p-4 text-left transition-all ${
                activeStepIndex === index
                  ? "border-accent bg-accent-muted ring-2 ring-accent/15"
                  : "border-border bg-card hover:border-accent/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    activeStepIndex === index
                      ? "bg-accent-bg text-on-accent"
                      : "bg-muted text-secondary"
                  }`}
                >
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-primary">Step {index + 1}</p>
                  <p className="mt-0.5 truncate text-xs text-secondary">
                    {step.subject || "No subject"}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {/* Add Step Button */}
          <button
            onClick={addStep}
            className="w-full rounded-md border-2 border-dashed border-border bg-card p-4 text-base font-medium text-secondary transition-colors hover:border-accent/30 hover:text-accent"
          >
            <Plus className="mx-auto h-5 w-5" />
            Add Step
          </button>
        </div>
      </div>

      {/* Center: Editor */}
      <div className="col-span-6">
        {activeStep ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-primary">
                Edit Step {activeStepIndex + 1}
              </h3>
              {draft.steps.length > 1 && (
                <button
                  onClick={() => removeStep(activeStepIndex)}
                  className="flex items-center gap-2 rounded-md border border-error/30 bg-card px-3 py-1.5 text-sm font-semibold text-error transition-colors hover:bg-error-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Step
                </button>
              )}
            </div>

            {/* Variable Picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-secondary">
                Insert Variable:
              </label>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-sm text-primary transition-colors hover:border-accent/30 hover:bg-accent-muted"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-secondary">
                Use spintax for variations: {"{option1|option2|option3}"}
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="mb-2 block text-base font-medium text-primary">
                Subject Line <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={activeStep.subject}
                onChange={(e) => updateStep(activeStepIndex, "subject", e.target.value)}
                placeholder="e.g., Quick question about {{company}}"
                className="w-full font-mono rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
              />
              {!subjectValid && (
                <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                  <AlertCircle className="h-4 w-4" />
                  Unbalanced braces in spintax
                </div>
              )}
            </div>

            {/* Body */}
            <div>
              <label className="mb-2 block text-base font-medium text-primary">
                Email Body <span className="text-error">*</span>
              </label>
              <textarea
                value={activeStep.body}
                onChange={(e) => updateStep(activeStepIndex, "body", e.target.value)}
                placeholder="Hi {{firstName}},&#10;&#10;I noticed {{company}} is..."
                rows={12}
                className="w-full font-mono rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 px-3 py-2"
              />
              {!bodyValid && (
                <div className="mt-2 flex items-center gap-2 text-sm text-warning">
                  <AlertCircle className="h-4 w-4" />
                  Unbalanced braces in spintax
                </div>
              )}
              {subjectValid && bodyValid && (
                <div className="mt-2 flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Syntax valid
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-12">
            <div className="text-center">
              <Mail className="mx-auto mb-4 h-12 w-12 text-secondary/70" />
              <p className="text-base text-secondary">No steps yet. Click "Add Step" to begin.</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Preview */}
      <div className="col-span-3">
        <div className="sticky top-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-medium text-primary">
              <Eye className="h-4 w-4" />
              Preview
            </h3>
          </div>

          {previewContacts.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-secondary">Preview as:</label>
              <select
                value={previewContactIndex}
                onChange={(e) => setPreviewContactIndex(Number(e.target.value))}
                className="w-full text-sm rounded-md border border-border-strong bg-card text-base transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:opacity-50 h-9 pl-3 pr-3"
              >
                {previewContacts.map((contact: any, index: any) => (
                  <option key={contact._id} value={index}>
                    {contact.customVars?.name || contact.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted p-4">{renderPreview()}</div>
        </div>
      </div>
    </div>
  );
}
