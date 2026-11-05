"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, requestJson } from "@/lib/request";

export interface AddMailboxDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConnected: () => void;
}

// "smtp" is any server the user names; the others fill in their own hosts on the server.
type SmtpProvider = "smtp" | "mailpool" | "puzzle";

const SMTP_PROVIDERS = [
  { value: "smtp", label: "Custom SMTP / IMAP server" },
  { value: "mailpool", label: "Mailpool" },
  { value: "puzzle", label: "Puzzle" },
];

const EMPTY_FORM = {
  provider: "smtp" as SmtpProvider,
  name: "",
  username: "",
  password: "",
  dailySendLimit: 50,
  smtpHost: "",
  smtpPort: 587,
  imapHost: "",
  imapPort: 993,
};

export function AddMailboxDialog({ isOpen, onOpenChange, onConnected }: AddMailboxDialogProps) {
  const [step, setStep] = React.useState<"choose" | "smtp">("choose");
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isCustom = form.provider === "smtp";
  const update = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  React.useEffect(() => {
    if (!isOpen) {
      setStep("choose");
      setForm(EMPTY_FORM);
    }
  }, [isOpen]);

  const close = () => {
    if (!isSubmitting) onOpenChange(false);
  };

  const missing = [
    !form.name.trim() && "a name",
    !form.username.trim() && "the email address",
    !form.password && "the app password",
    isCustom && !form.smtpHost.trim() && "the SMTP host",
    isCustom && !form.imapHost.trim() && "the IMAP host",
  ].filter(Boolean);

  async function connectSmtp() {
    if (missing.length > 0) {
      toast.error(`Add ${missing.join(", ")}.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await requestJson("/api/mailboxes/connect-smtp", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          provider: form.provider,
          username: form.username.trim(),
          password: form.password,
          dailySendLimit: form.dailySendLimit,
          ...(isCustom
            ? {
                smtpHost: form.smtpHost.trim(),
                smtpPort: form.smtpPort,
                imapHost: form.imapHost.trim(),
                imapPort: form.imapPort,
              }
            : {}),
        }),
      });
      toast.success("Mailbox connected");
      onOpenChange(false);
      onConnected();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const logo = (src: string, alt: string) => <Image src={src} alt={alt} width={24} height={24} />;

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && close()} purpose="form" width={520}>
      <Layout
        header={
          <DialogHeader
            title="Connect a mailbox"
            subtitle={
              step === "choose"
                ? "Choose where your sending account lives."
                : "Enter the details for this account."
            }
            onOpenChange={close}
          />
        }
        content={
          <LayoutContent>
            {step === "choose" ? (
              <List hasDividers>
                <ListItem
                  label="Google Workspace"
                  description="Sign in with Google. Recommended."
                  startContent={logo("/logos/google.svg", "")}
                  endContent={<Icon icon="chevronRight" color="secondary" />}
                  onClick={() => {
                    window.location.href = "/api/auth/google";
                  }}
                />
                <ListItem
                  label="Microsoft 365"
                  description="Sign in with Microsoft. Recommended."
                  startContent={logo("/logos/microsoft.svg", "")}
                  endContent={<Icon icon="chevronRight" color="secondary" />}
                  onClick={() => {
                    window.location.href = "/api/auth/microsoft";
                  }}
                />
                <ListItem
                  label="SMTP / IMAP"
                  description="Any provider, with its server details and an app password."
                  startContent={<Icon icon={Mail} color="secondary" />}
                  endContent={<Icon icon="chevronRight" color="secondary" />}
                  onClick={() => setStep("smtp")}
                />
              </List>
            ) : (
              <VStack gap={4}>
                <Selector
                  label="Provider"
                  width="100%"
                  value={form.provider}
                  onChange={(value) => update("provider", value as SmtpProvider)}
                  options={SMTP_PROVIDERS}
                />
                <TextInput
                  label="Name"
                  description="Only your team sees this."
                  width="100%"
                  value={form.name}
                  onChange={(value) => update("name", value)}
                  placeholder="Sales mailbox 1"
                  isRequired
                />
                <TextInput
                  label="Email address"
                  type="email"
                  width="100%"
                  value={form.username}
                  onChange={(value) => update("username", value)}
                  placeholder="hello@example.com"
                  autoComplete="off"
                  isRequired
                />
                <TextInput
                  label="App password"
                  description="An app-specific password, not your main account password."
                  type="password"
                  width="100%"
                  value={form.password}
                  onChange={(value) => update("password", value)}
                  autoComplete="new-password"
                  isRequired
                />
                {isCustom ? (
                  <Grid columns={{ minWidth: 160, repeat: "fit" }} gap={3}>
                    <TextInput
                      label="SMTP host"
                      width="100%"
                      value={form.smtpHost}
                      onChange={(value) => update("smtpHost", value)}
                      placeholder="smtp.example.com"
                      isRequired
                    />
                    <NumberInput
                      label="SMTP port"
                      width="100%"
                      value={form.smtpPort}
                      onChange={(value) => update("smtpPort", value)}
                      min={1}
                      max={65535}
                      isIntegerOnly
                    />
                    <TextInput
                      label="IMAP host"
                      width="100%"
                      value={form.imapHost}
                      onChange={(value) => update("imapHost", value)}
                      placeholder="imap.example.com"
                      isRequired
                    />
                    <NumberInput
                      label="IMAP port"
                      width="100%"
                      value={form.imapPort}
                      onChange={(value) => update("imapPort", value)}
                      min={1}
                      max={65535}
                      isIntegerOnly
                    />
                  </Grid>
                ) : null}
                <NumberInput
                  label="Daily send limit"
                  description="Most providers allow 30 to 50 cold emails a day per mailbox."
                  width="100%"
                  value={form.dailySendLimit}
                  onChange={(value) => update("dailySendLimit", value)}
                  min={1}
                  max={2000}
                  isIntegerOnly
                  units="a day"
                />
              </VStack>
            )}
          </LayoutContent>
        }
        footer={
          step === "smtp" ? (
            <LayoutFooter>
              <HStack gap={2} hAlign="between">
                <Button
                  label="Back"
                  variant="ghost"
                  icon={<Icon icon={ArrowLeft} />}
                  isDisabled={isSubmitting}
                  onClick={() => setStep("choose")}
                />
                <HStack gap={2}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    isDisabled={isSubmitting}
                    onClick={close}
                  />
                  <Button
                    label="Connect mailbox"
                    variant="primary"
                    isLoading={isSubmitting}
                    onClick={() => void connectSmtp()}
                  />
                </HStack>
              </HStack>
            </LayoutFooter>
          ) : undefined
        }
      />
    </Dialog>
  );
}
