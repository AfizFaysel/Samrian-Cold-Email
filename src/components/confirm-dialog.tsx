import * as React from "react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading?: boolean;
}

/** Confirms a consequential action. Callers close it once the action settles. */
export function ConfirmDialog({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  isOpen,
  onOpenChange,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!isLoading) onOpenChange(open);
      }}
      title={title}
      description={description}
      actionLabel={confirmText}
      cancelLabel={cancelText}
      actionVariant={variant === "destructive" ? "destructive" : "primary"}
      isActionLoading={isLoading}
      onAction={() => void onConfirm()}
    />
  );
}
