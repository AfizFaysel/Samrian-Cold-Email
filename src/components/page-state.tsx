import * as React from "react";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/VStack";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/** Astryx EmptyState with a plain icon: no tinted tile, the design system draws none. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <VStack paddingInline={6} paddingBlock={10} className={className}>
      <AstryxEmptyState
        title={title}
        description={description}
        icon={icon ? <Icon icon={icon} size="lg" color="secondary" /> : undefined}
        actions={action}
      />
    </VStack>
  );
}

export function ErrorState({
  title = "Couldn't load this page",
  description = "Something went wrong on our side or the connection dropped. Your data is safe.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <VStack role="alert" paddingInline={6} paddingBlock={10} className={className}>
      <AstryxEmptyState
        title={title}
        description={description}
        icon={<Icon icon="error" size="lg" color="error" />}
        actions={
          onRetry ? (
            <Button
              label="Try again"
              variant="secondary"
              icon={<Icon icon={RotateCw} />}
              onClick={onRetry}
            />
          ) : undefined
        }
      />
    </VStack>
  );
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <VStack role="status" hAlign="center" paddingInline={6} paddingBlock={10} className={className}>
      <Spinner label={label} />
    </VStack>
  );
}

/** Placeholder rows for a list or table while it loads. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <VStack gap={0} className={cn("divide-y divide-border", className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <HStack key={index} gap={4} vAlign="center" paddingInline={4} paddingBlock={3}>
          <Skeleton width={32} height={32} radius="rounded" index={index} />
          <VStack gap={1.5} className="flex-1">
            <Skeleton width="33%" height={14} index={index} />
            <Skeleton width="20%" height={12} index={index} />
          </VStack>
          <Skeleton width={64} height={20} radius="rounded" index={index} />
        </HStack>
      ))}
    </VStack>
  );
}
