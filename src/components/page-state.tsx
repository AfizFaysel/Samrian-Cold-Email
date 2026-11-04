import * as React from "react";
import { EmptyState as AstryxEmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
    <div className={cn("px-6 py-12", className)}>
      <AstryxEmptyState
        title={title}
        description={description}
        icon={icon ? <Icon icon={icon} size="lg" color="secondary" /> : undefined}
        actions={action}
      />
    </div>
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
    <div role="alert" className={cn("px-6 py-12", className)}>
      <AstryxEmptyState
        title={title}
        description={description}
        icon={<Icon icon="error" size="lg" color="error" />}
        actions={
          onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RotateCw data-icon="inline-start" />
              Try again
            </Button>
          ) : undefined
        }
      />
    </div>
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
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-14 text-base text-secondary",
        className
      )}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** Placeholder rows for a list or table while it loads. */
export function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-border", className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
