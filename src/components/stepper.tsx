import * as React from "react";
import { Step, Stepper as AstryxStepper } from "@astryxdesign/core/Stepper";

/** Horizontal progress through a wizard. Done steps can be revisited; later ones cannot. */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: ReadonlyArray<{ id: number; name: string }>;
  /** One-based id of the current step. */
  current: number;
  onSelect?: (id: number) => void;
}) {
  return (
    <AstryxStepper
      activeStep={current - 1}
      onStepClick={onSelect ? (index) => onSelect(steps[index].id) : undefined}
      // The wizard owns Back and Continue, so the narrow layout shows only the label.
      horizontalOptions={{ minimumStepWidth: 112, collapsedVariant: "withLabel" }}
    >
      {steps.map((step, index) => (
        <Step
          key={step.id}
          step={index}
          label={step.name}
          isDisabled={!onSelect || step.id > current}
        />
      ))}
    </AstryxStepper>
  );
}
