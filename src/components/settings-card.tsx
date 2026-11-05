import * as React from "react";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

/** One settings group: title, what it controls, its fields, and an optional save bar. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card padding={5}>
      <VStack gap={5}>
        <VStack gap={1}>
          <Heading level={3}>{title}</Heading>
          {description ? <Text type="supporting">{description}</Text> : null}
        </VStack>
        {children}
        {footer ? (
          <>
            <Divider />
            {footer}
          </>
        ) : null}
      </VStack>
    </Card>
  );
}

export type SaveState = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

/** Save button with the last result beside it. */
export function SaveBar({ state, onSave }: { state: SaveState; onSave: () => void }) {
  return (
    <HStack gap={3} hAlign="end" vAlign="center" wrap="wrap">
      {state.kind === "saved" ? (
        <HStack gap={1.5} vAlign="center" role="status" className="mr-auto">
          <Icon icon="success" color="success" size="sm" />
          <Text type="supporting">Saved</Text>
        </HStack>
      ) : state.kind === "error" ? (
        <HStack gap={1.5} vAlign="center" role="status" className="mr-auto">
          <Icon icon="error" color="error" size="sm" />
          <Text type="supporting">{state.message}</Text>
        </HStack>
      ) : null}
      <Button
        label="Save changes"
        variant="primary"
        isLoading={state.kind === "saving"}
        onClick={onSave}
      />
    </HStack>
  );
}
