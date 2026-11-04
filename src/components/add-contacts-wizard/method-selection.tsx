"use client";

import * as React from "react";
import { Upload, Edit } from "lucide-react";
import type { ImportMethod } from "./index";
import { StepHeader, WizardFooter, WizardContainer, SecurityShieldIcon } from "./shared";

interface MethodSelectionProps {
  onSelect: (method: ImportMethod) => void;
  onCancel: () => void;
}

export function MethodSelection({ onSelect, onCancel }: MethodSelectionProps) {
  const [selected, setSelected] = React.useState<ImportMethod>(null);

  const methods = [
    {
      id: "csv" as const,
      icon: Upload,
      title: "Upload a CSV",
      description: "Import a spreadsheet export. You map its columns next.",
      badge: "Recommended",
    },
    {
      id: "manual" as const,
      icon: Edit,
      title: "Enter by hand",
      description: "Type in a few contacts one at a time.",
    },
  ];

  return (
    <WizardContainer>
      <StepHeader
        stepNumber={1}
        stepLabel="Method"
        title="How do you want to add contacts?"
        description="Pick a source. Nothing is saved until you review and confirm."
      />

      {/* Method Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const Icon = method.icon;
          const isSelected = selected === method.id;

          return (
            <button
              key={method.id}
              onClick={() => setSelected(method.id)}
              aria-pressed={isSelected}
              className={`group relative flex flex-col items-start rounded-lg border p-5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isSelected
                  ? "border-accent bg-accent-muted ring-1 ring-accent"
                  : "border-border bg-card hover:border-border-strong"
              }`}
            >
              {method.badge && (
                <div className="absolute top-4 right-4 rounded-full bg-muted px-2 py-0.5 text-sm font-medium text-secondary">
                  {method.badge}
                </div>
              )}

              <div
                className={`mb-4 flex size-9 items-center justify-center rounded-md transition-colors ${
                  isSelected ? "bg-accent-bg text-on-accent" : "bg-muted text-primary"
                }`}
              >
                <Icon className="size-4" />
              </div>

              <h3 className="mb-1 text-base font-semibold">{method.title}</h3>
              <p className="text-base leading-relaxed text-secondary">{method.description}</p>
            </button>
          );
        })}
      </div>

      <WizardFooter
        onCancel={onCancel}
        onNext={() => selected && onSelect(selected)}
        nextLabel="Continue"
        nextDisabled={!selected}
        showBackButton={false}
        leftContent={
          <div className="flex items-center gap-3 text-base text-secondary">
            <SecurityShieldIcon />
            <span>Contacts stay in your own database.</span>
          </div>
        }
      />
    </WizardContainer>
  );
}
