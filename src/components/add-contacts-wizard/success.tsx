"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Megaphone, Users } from "lucide-react";
import type { ImportResult } from "./review-validation";

interface SuccessProps {
  result: ImportResult;
  onClose: () => void;
}

const plural = (count: number) => `${count} ${count === 1 ? "contact" : "contacts"}`;

export function Success({ result, onClose }: SuccessProps) {
  const router = useRouter();
  const details = [
    result.updated > 0 && `${plural(result.updated)} updated`,
    result.skipped > 0 && `${plural(result.skipped)} skipped`,
  ].filter(Boolean);

  return (
    <VStack gap={2} hAlign="center" paddingInline={6} paddingBlock={10} className="text-center">
      <Icon icon="success" color="success" size="lg" />
      <Heading level={2}>{plural(result.created)} added</Heading>
      {details.length > 0 ? <Text type="supporting">{details.join(", ")}.</Text> : null}
      <Text type="supporting">
        They&apos;re in your list now. Start a campaign to reach them, or head back to your
        contacts.
      </Text>
      <HStack gap={2} hAlign="center" wrap="wrap" paddingBlock={4}>
        <Button
          label="View contacts"
          variant="secondary"
          icon={<Icon icon={Users} />}
          onClick={onClose}
        />
        <Button
          label="Start a campaign"
          variant="primary"
          icon={<Icon icon={Megaphone} />}
          onClick={() => router.push("/dashboard/campaigns/new")}
        />
      </HStack>
    </VStack>
  );
}
