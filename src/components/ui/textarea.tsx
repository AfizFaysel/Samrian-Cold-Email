import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-border-strong bg-card px-2.5 py-2 text-lg transition-colors outline-none placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 md:text-base dark:bg-card dark:disabled:bg-muted dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
