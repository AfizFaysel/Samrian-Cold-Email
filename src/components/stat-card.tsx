import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One headline figure: small label, large tabular number, one supporting line. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-secondary">{label}</span>
        {Icon && <Icon className="size-4 text-secondary" />}
      </div>
      {isLoading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <span className="text-3xl leading-9 font-semibold tracking-tight tabular-nums">
          {value}
        </span>
      )}
      {hint && <span className="text-sm text-secondary">{hint}</span>}
    </div>
  );
}
