import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A styled native <select>: keyboard and mobile pickers for free. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        data-slot="native-select"
        className="h-8 w-full min-w-0 appearance-none rounded-md border border-border-strong bg-card py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-secondary"
        aria-hidden
      />
    </div>
  );
}

export { NativeSelect };
