"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-popover !text-primary !shadow-lg !font-sans",
          description: "!text-secondary",
          actionButton: "!bg-accent-bg !text-on-accent",
        },
      }}
    />
  );
}
