"use client";

import * as React from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Download, FileText } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";

export type InboxAttachment = {
  id: string;
  filename: string;
  size: number;
  contentType?: string;
  inline: boolean;
};

const WARNING_KEY = "samrian:attachment-warning-accepted";

export function InboxAttachments({
  threadId,
  attachments,
}: {
  threadId: string;
  attachments?: InboxAttachment[];
}) {
  const [pending, setPending] = React.useState<InboxAttachment>();
  const [error, setError] = React.useState<string>();
  if (!attachments?.length) return null;

  async function requestDownload(attachment: InboxAttachment) {
    setError(undefined);
    if (sessionStorage.getItem(WARNING_KEY) !== "yes") {
      setPending(attachment);
      return;
    }
    await download(attachment);
  }

  async function download(attachment: InboxAttachment) {
    const response = await fetch(
      `/api/inbox/threads/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(attachment.id)}`
    );
    if (response.status === 409) {
      const result = (await response.json()) as { providerUrl?: string };
      if (result.providerUrl) window.open(result.providerUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
      };
      setError(result.error ?? attachmentError(result.reason));
      return;
    }
    const blob = await response.blob();
    if (typeof URL.createObjectURL !== "function") return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <VStack gap={2}>
      <Divider />
      <Text type="supporting" weight="medium">
        Attachments
      </Text>
      <HStack gap={2} wrap="wrap">
        {attachments.map((attachment) => (
          <Button
            key={attachment.id}
            label={`Download ${attachment.filename}`}
            variant="secondary"
            size="sm"
            icon={<Icon icon={FileText} />}
            endContent={<Icon icon={Download} />}
            onClick={() => void requestDownload(attachment)}
          >
            {`${attachment.filename} · ${formatBytes(attachment.size)}`}
          </Button>
        ))}
      </HStack>
      {error ? <Banner status="error" title={error} /> : null}
      <ConfirmDialog
        title="Download attachment?"
        description="Attachments can contain harmful content. Gmail or Outlook may have screened this file, but no screening guarantees safety. Download only if you trust the sender."
        confirmText="Download anyway"
        isOpen={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) setPending(undefined);
        }}
        onConfirm={() => {
          if (!pending) return;
          sessionStorage.setItem(WARNING_KEY, "yes");
          const attachment = pending;
          setPending(undefined);
          void download(attachment);
        }}
      />
    </VStack>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentError(reason?: string) {
  if (reason === "unsupported-type") return "This file type is not available for download.";
  if (reason === "too-large") return "This file exceeds Samrian's download limit.";
  return "Attachment download failed.";
}
