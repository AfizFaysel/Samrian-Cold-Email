"use client";

import * as React from "react";
import { Activity, Gauge, Globe, Pause, Play, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { errorMessage, requestJson, responseError } from "@/lib/request";
import { TIMEZONES } from "@/lib/timezones";
import type { MailboxListItem } from "./columns";

type RampAction = "enable" | "disable" | "pause" | "resume" | "reset" | "update";
type Confirm = "delete" | "archive" | "reset";

const RAMP_MESSAGES: Record<RampAction, string> = {
  enable: "Mailbox ramp enabled",
  disable: "Mailbox ramp disabled",
  pause: "Mailbox ramp paused",
  resume: "Mailbox ramp resumed",
  reset: "Mailbox ramp reset",
  update: "Ramp target updated",
};

const MIN_TARGET = 5;
const MAX_TARGET = 100;

export function MailboxActions({
  mailbox,
  onChanged,
}: {
  mailbox: MailboxListItem;
  onChanged: () => void;
}) {
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);
  const [isTargetOpen, setIsTargetOpen] = React.useState(false);
  const [target, setTarget] = React.useState(mailbox.rampTargetLimit || 30);
  const [isBusy, setIsBusy] = React.useState(false);
  const [isZoneOpen, setIsZoneOpen] = React.useState(false);
  const [zone, setZone] = React.useState(mailbox.timezone ?? "UTC");
  const base = `/api/mailboxes/${mailbox._id}`;
  const isPaused = mailbox.rampStatus === "paused";

  const run = async (work: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await work();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  const changeRamp = (action: RampAction, targetLimit = mailbox.rampTargetLimit || 30) =>
    run(async () => {
      await requestJson(`${base}/ramp`, {
        method: "PATCH",
        body: JSON.stringify({ action, targetLimit }),
      });
      toast.success(RAMP_MESSAGES[action]);
      setConfirm(null);
      setIsTargetOpen(false);
      onChanged();
    });

  const checkMailbox = () =>
    run(async () => {
      const result = await requestJson<{ status: string; issue?: string }>(`${base}/check`, {
        method: "POST",
      });
      if (result.status === "healthy") toast.success("Mailbox healthy");
      else toast.error(result.issue ?? "Mailbox needs attention");
      onChanged();
    });

  const reconnectMailbox = () =>
    run(async () => {
      const result = await requestJson<{ reconnectUrl?: string }>(`${base}/reconnect`, {
        method: "POST",
        body: "{}",
      });
      if (result.reconnectUrl) {
        window.location.href = result.reconnectUrl;
        return;
      }
      toast.success("Mailbox reconnected");
      onChanged();
    });

  const evaluateRamp = () =>
    run(async () => {
      const result = await requestJson<{ decision: { status: string; reason: string } }>(
        `${base}/ramp/evaluate`,
        { method: "POST" }
      );
      toast.success(`Ramp ${result.decision.status}: ${result.decision.reason}`);
      onChanged();
    });

  const saveZone = () =>
    run(async () => {
      await requestJson(base, {
        method: "PATCH",
        body: JSON.stringify({ timezone: zone === "UTC" ? null : zone }),
      });
      toast.success("Time zone saved");
      setIsZoneOpen(false);
      onChanged();
    });

  const deleteMailbox = (force: boolean) =>
    run(async () => {
      const response = await fetch(force ? `${base}?force=true` : base, { method: "DELETE" });
      if (response.status === 409 && !force) {
        setConfirm("archive");
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      toast.success("Mailbox archived");
      setConfirm(null);
      onChanged();
    });

  const items: DropdownMenuOption[] = [
    {
      label: "Copy mailbox ID",
      icon: "copy",
      onClick: () => {
        void navigator.clipboard.writeText(mailbox._id);
        toast.success("Mailbox ID copied");
      },
    },
    { type: "divider" },
    {
      type: "section",
      title: "Connection",
      items: [
        {
          label: "Test connection",
          icon: Activity,
          isDisabled: isBusy,
          onClick: () => void checkMailbox(),
        },
        {
          label: "Reconnect",
          icon: RefreshCw,
          isDisabled: isBusy,
          onClick: () => void reconnectMailbox(),
        },
      ],
    },
    {
      type: "section",
      title: "Sending",
      items: [
        {
          label: "Set time zone",
          icon: Globe,
          isDisabled: isBusy,
          onClick: () => {
            setZone(mailbox.timezone ?? "UTC");
            setIsZoneOpen(true);
          },
        },
      ],
    },
    {
      type: "section",
      title: "Ramp",
      items: mailbox.rampEnabled
        ? [
            {
              label: "Evaluate ramp",
              icon: Gauge,
              isDisabled: isBusy,
              onClick: () => void evaluateRamp(),
            },
            {
              label: isPaused ? "Resume ramp" : "Pause ramp",
              icon: isPaused ? Play : Pause,
              isDisabled: isBusy,
              onClick: () => void changeRamp(isPaused ? "resume" : "pause"),
            },
            {
              label: "Set ramp target",
              icon: Gauge,
              isDisabled: isBusy,
              onClick: () => {
                setTarget(mailbox.rampTargetLimit || 30);
                setIsTargetOpen(true);
              },
            },
            {
              label: "Reset ramp",
              icon: RotateCcw,
              isDisabled: isBusy,
              onClick: () => setConfirm("reset"),
            },
          ]
        : [
            {
              label: "Enable ramp",
              icon: Play,
              isDisabled: isBusy,
              onClick: () => void changeRamp("enable"),
            },
          ],
    },
    { type: "divider" },
    {
      label: "Delete",
      icon: Trash2,
      variant: "destructive",
      isDisabled: isBusy,
      onClick: () => setConfirm("delete"),
    },
  ];

  const closeConfirm = (isOpen: boolean) => {
    if (!isOpen && !isBusy) setConfirm(null);
  };

  return (
    <>
      <DropdownMenu
        alignment="end"
        menuMaxHeight={440}
        items={items}
        renderTrigger={(props) => (
          <IconButton
            {...props}
            icon={<Icon icon="moreHorizontal" />}
            label={`Actions for ${mailbox.userEmail || mailbox.name}`}
            variant="ghost"
            size="sm"
            isLoading={isBusy}
          />
        )}
      />

      <AlertDialog
        isOpen={confirm === "reset"}
        onOpenChange={closeConfirm}
        title="Reset the ramp?"
        description={`This mailbox goes back to ${MIN_TARGET} sends a day and climbs again from there.`}
        actionLabel="Reset ramp"
        isActionLoading={isBusy}
        onAction={() => changeRamp("reset")}
      />
      <AlertDialog
        isOpen={confirm === "delete"}
        onOpenChange={closeConfirm}
        title="Delete this mailbox?"
        description={`${mailbox.userEmail || mailbox.name} stops sending and is archived.`}
        actionLabel="Delete mailbox"
        isActionLoading={isBusy}
        onAction={() => deleteMailbox(false)}
      />
      <AlertDialog
        isOpen={confirm === "archive"}
        onOpenChange={closeConfirm}
        title="Archive instead?"
        description="Campaigns still use this mailbox, so it can't be deleted. Archiving stops it sending and keeps its history."
        actionLabel="Archive mailbox"
        isActionLoading={isBusy}
        onAction={() => deleteMailbox(true)}
      />

      <Dialog
        isOpen={isTargetOpen}
        onOpenChange={(isOpen) => !isBusy && setIsTargetOpen(isOpen)}
        purpose="form"
        width={420}
      >
        <Layout
          header={
            <DialogHeader
              title="Set ramp target"
              subtitle="The daily send limit this mailbox climbs to while it warms up."
              onOpenChange={() => !isBusy && setIsTargetOpen(false)}
            />
          }
          content={
            <LayoutContent>
              <NumberInput
                label="Sends per day"
                description={`Between ${MIN_TARGET} and ${MAX_TARGET}.`}
                value={target}
                onChange={setTarget}
                onEnter={() => void changeRamp("update", target)}
                min={MIN_TARGET}
                max={MAX_TARGET}
                step={1}
                isIntegerOnly
                hasNumberSteppers
                isRequired
                hasAutoFocus
                units="a day"
                width="100%"
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="Cancel"
                  variant="secondary"
                  isDisabled={isBusy}
                  onClick={() => setIsTargetOpen(false)}
                />
                <Button
                  label="Save target"
                  variant="primary"
                  isLoading={isBusy}
                  onClick={() => void changeRamp("update", target)}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog
        isOpen={isZoneOpen}
        onOpenChange={(isOpen) => !isBusy && setIsZoneOpen(isOpen)}
        purpose="form"
        width={420}
      >
        <Layout
          header={
            <DialogHeader
              title="Set time zone"
              subtitle="The daily send count starts over at midnight in this time zone."
              onOpenChange={() => !isBusy && setIsZoneOpen(false)}
            />
          }
          content={
            <LayoutContent>
              <Selector
                label="Time zone"
                width="100%"
                value={zone}
                onChange={setZone}
                options={zoneOptions(mailbox.timezone)}
              />
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button
                  label="Cancel"
                  variant="secondary"
                  isDisabled={isBusy}
                  onClick={() => setIsZoneOpen(false)}
                />
                <Button
                  label="Save time zone"
                  variant="primary"
                  isLoading={isBusy}
                  onClick={() => void saveZone()}
                />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}

// A zone set through the API may not be in the short list, so it is kept as an option.
function zoneOptions(current: string | undefined) {
  const options = [{ value: "UTC", label: "UTC" }, ...TIMEZONES];
  return current && !options.some((option) => option.value === current)
    ? [...options, { value: current, label: current }]
    : options;
}
