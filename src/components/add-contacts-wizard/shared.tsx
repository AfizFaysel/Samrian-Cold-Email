"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared Step Header Component
interface StepHeaderProps {
  stepNumber: number;
  stepLabel: string;
  title: string;
  description: string;
}

export function StepHeader({ stepNumber, stepLabel, title, description }: StepHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-1.5">
      <span className="text-sm font-medium text-accent">
        Step {stepNumber} · {stepLabel}
      </span>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-2xl text-base text-secondary">{description}</p>
    </div>
  );
}

// Shared Footer Navigation Component
interface WizardFooterProps {
  onBack?: () => void;
  onCancel: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  isLoading?: boolean;
  showBackButton?: boolean;
  leftContent?: React.ReactNode;
}

export function WizardFooter({
  onBack,
  onCancel,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  isLoading = false,
  showBackButton = true,
  leftContent,
}: WizardFooterProps) {
  return (
    <div className="-mx-6 -mb-6 mt-8 flex flex-col-reverse gap-3 border-t bg-muted/40 px-6 py-4 sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      {leftContent || (
        <>
          {showBackButton && onBack ? (
            <Button variant="ghost" onClick={onBack} disabled={isLoading}>
              <ChevronLeft data-icon="inline-start" />
              Back
            </Button>
          ) : (
            <div />
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <CancelButton onClick={onCancel} disabled={isLoading} />
        {onNext && (
          <PrimaryButton
            onClick={onNext}
            disabled={nextDisabled || isLoading}
            isLoading={isLoading}
          >
            {nextLabel}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

// Shared Button Components
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  isLoading?: boolean;
}

export function PrimaryButton({ onClick, disabled, children }: ButtonProps) {
  return (
    <Button onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}

export function CancelButton({ onClick, disabled }: Omit<ButtonProps, "children" | "isLoading">) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled}>
      Cancel
    </Button>
  );
}

// Shared Icons
export function BackArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

export function CheckmarkIcon() {
  return (
    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function SecurityShieldIcon() {
  return (
    <svg
      className="size-4 shrink-0 text-success"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// Shared Container
interface WizardContainerProps {
  children: React.ReactNode;
}

export function WizardContainer({ children }: WizardContainerProps) {
  return <div className="p-6 sm:p-8">{children}</div>;
}
