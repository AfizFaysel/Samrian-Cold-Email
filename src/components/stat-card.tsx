import * as React from "react";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

/** One headline figure: small label, large tabular number, one supporting line. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  isLoading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <Card padding={4} className={className}>
      <VStack gap={2}>
        <HStack gap={2} hAlign="between" vAlign="center">
          <Text type="supporting" weight="medium">
            {label}
          </Text>
          {icon && <Icon icon={icon} size="sm" color="secondary" />}
        </HStack>
        {isLoading ? (
          <Skeleton width={96} height={32} />
        ) : (
          <Text type="display-3" className="tabular-nums">
            {value}
          </Text>
        )}
        {hint && <Text type="supporting">{hint}</Text>}
      </VStack>
    </Card>
  );
}
