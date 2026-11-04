import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-border-strong bg-card px-2.5 py-1 text-lg transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-base file:font-medium file:text-primary placeholder:text-secondary focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 md:text-base dark:bg-card dark:disabled:bg-muted dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40",
        className
      )}
      {...props}
    />
  );
}

export { Input };
