import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Horizontal progress through a wizard. Done steps can be revisited; later ones cannot. */
export function Stepper({
  steps,
  current,
  onSelect,
  className,
}: {
  steps: ReadonlyArray<{ id: number; name: string }>;
  current: number;
  onSelect?: (id: number) => void;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2 overflow-x-auto", className)}>
      {steps.map((step, index) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <button
              type="button"
              onClick={() => onSelect?.(step.id)}
              disabled={!onSelect || step.id > current}
              aria-current={active ? "step" : undefined}
              className="group flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-colors",
                  done && "border-accent bg-accent-bg text-on-accent",
                  active && "border-accent bg-accent-muted text-accent",
                  !done && !active && "border-border bg-card text-secondary"
                )}
              >
                {done ? <Check className="size-3.5" /> : step.id}
              </span>
              <span
                className={cn(
                  "text-base whitespace-nowrap",
                  active ? "font-medium text-primary" : "text-secondary",
                  done && "group-hover:text-primary"
                )}
              >
                {step.name}
              </span>
            </button>
            {index < steps.length - 1 && (
              <span
                className={cn("h-px min-w-4 flex-1", done ? "bg-accent-bg" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
