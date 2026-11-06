"use client";

import * as React from "react";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { ChevronLeft } from "lucide-react";

interface StepHeaderProps {
  stepNumber: number;
  stepLabel: string;
  title: string;
  description: string;
}

export function StepHeader({ stepNumber, stepLabel, title, description }: StepHeaderProps) {
  return (
    <VStack gap={1}>
      <Text type="label" color="accent">
        Step {stepNumber} · {stepLabel}
      </Text>
      <Heading level={2}>{title}</Heading>
      <Text type="supporting">{description}</Text>
    </VStack>
  );
}

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
    <VStack gap={4}>
      <Divider />
      <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
        {leftContent ??
          (showBackButton && onBack ? (
            <Button
              label="Back"
              variant="ghost"
              icon={<Icon icon={ChevronLeft} />}
              isDisabled={isLoading}
              onClick={onBack}
            />
          ) : (
            <HStack />
          ))}
        <HStack gap={2}>
          <Button label="Cancel" variant="secondary" isDisabled={isLoading} onClick={onCancel} />
          {onNext ? (
            <Button
              label={nextLabel}
              variant="primary"
              isLoading={isLoading}
              isDisabled={nextDisabled}
              onClick={onNext}
            />
          ) : null}
        </HStack>
      </HStack>
    </VStack>
  );
}

export function WizardContainer({ children }: { children: React.ReactNode }) {
  return (
    <VStack gap={8} padding={6}>
      {children}
    </VStack>
  );
}
