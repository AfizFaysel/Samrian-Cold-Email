"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { ApiKeys } from "@/components/api-keys";
import { MembersRoles } from "@/components/members-roles";
import { Page } from "@/components/page-header";
import { StatusPill } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TrackingSettings } from "@/components/tracking-settings";
import { errorMessage, requestJson } from "@/lib/request";
import { cn } from "@/lib/utils";

type ComplianceSettings = {
  listUnsubscribeEnabled: boolean;
  physicalAddress?: string | null;
  defaultSenderName?: string | null;
  unsubscribeFooter?: string | null;
  unsubscribeMailto?: string | null;
  bouncePauseRate: number;
  unsubscribePauseRate: number;
  complaintPauseRate: number;
};

type DomainReadiness = {
  status: "pass" | "warn" | "unknown";
  issues: string[];
  warnings: string[];
  cached: boolean;
};

type NotificationPrefs = {
  replyInAppEnabled: boolean;
  replyForwardEnabled: boolean;
  replyForwardEmails: string[];
  browserPushEnabled: boolean;
};

type SendingSettings = {
  defaultRampEnabled: boolean;
  defaultRampTarget: number;
  replyReserve: number;
};

const fallbackSettings: ComplianceSettings = {
  listUnsubscribeEnabled: false,
  bouncePauseRate: 0.05,
  unsubscribePauseRate: 0.1,
  complaintPauseRate: 0.001,
};

const fallbackNotificationPrefs: NotificationPrefs = {
  replyInAppEnabled: true,
  replyForwardEnabled: false,
  replyForwardEmails: [],
  browserPushEnabled: false,
};

const fallbackSendingSettings: SendingSettings = {
  defaultRampEnabled: false,
  defaultRampTarget: 30,
  replyReserve: 2,
};

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<ComplianceSettings>(fallbackSettings);
  const [status, setStatus] = React.useState("");
  const [domain, setDomain] = React.useState("");
  const [readiness, setReadiness] = React.useState<DomainReadiness | null>(null);
  const [domainStatus, setDomainStatus] = React.useState("");
  const [notificationPrefs, setNotificationPrefs] =
    React.useState<NotificationPrefs>(fallbackNotificationPrefs);
  const [notificationStatus, setNotificationStatus] = React.useState("");
  const [sending, setSending] = React.useState<SendingSettings>(fallbackSendingSettings);
  const [sendingStatus, setSendingStatus] = React.useState("");

  React.useEffect(() => {
    requestJson<Partial<ComplianceSettings>>("/api/settings/compliance")
      .then((data) => setSettings({ ...fallbackSettings, ...data }))
      .catch((error) => setStatus(errorMessage(error)));

    requestJson<Partial<NotificationPrefs>>("/api/settings/notifications")
      .then((data) => setNotificationPrefs({ ...fallbackNotificationPrefs, ...data }))
      .catch((error) => setNotificationStatus(errorMessage(error)));

    requestJson<Partial<SendingSettings>>("/api/settings/sending")
      .then((data) => setSending({ ...fallbackSendingSettings, ...data }))
      .catch((error) => setSendingStatus(errorMessage(error)));
  }, []);

  async function save() {
    setStatus("Saving...");
    try {
      const saved = await requestJson<Partial<ComplianceSettings>>("/api/settings/compliance", {
        method: "PATCH",
        // Tracking saves on its own switches; never resend the values loaded with this form.
        body: JSON.stringify(withoutTracking(settings)),
      });
      setSettings({ ...fallbackSettings, ...saved });
      setStatus("Saved");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }

  async function checkDomain() {
    if (!domain.trim()) return;
    setDomainStatus("Checking...");
    try {
      setReadiness(
        await requestJson(`/api/domains/check?domain=${encodeURIComponent(domain.trim())}`)
      );
      setDomainStatus("");
    } catch (error) {
      setDomainStatus(errorMessage(error));
    }
  }

  async function saveNotificationPrefs() {
    setNotificationStatus("Saving...");
    try {
      const saved = await requestJson<Partial<NotificationPrefs>>("/api/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(notificationPrefs),
      });
      setNotificationPrefs({ ...fallbackNotificationPrefs, ...saved });
      setNotificationStatus("Saved");
    } catch (error) {
      setNotificationStatus(errorMessage(error));
    }
  }

  async function saveSending() {
    setSendingStatus("Saving...");
    try {
      const saved = await requestJson<Partial<SendingSettings>>("/api/settings/sending", {
        method: "PATCH",
        body: JSON.stringify(sending),
      });
      setSending({ ...fallbackSendingSettings, ...saved });
      setSendingStatus("Saved");
    } catch (error) {
      setSendingStatus(errorMessage(error));
    }
  }

  return (
    <Page title="Settings" description="Compliance, sending limits, notifications and your team.">
      <Tabs defaultValue="general" className="gap-6">
        <TabsList
          variant="line"
          className="h-auto w-full flex-wrap justify-start gap-x-5 rounded-none border-b p-0 pb-1"
        >
          <TabsTrigger value="general" className="flex-none px-0">
            General
          </TabsTrigger>
          <TabsTrigger value="sending" className="flex-none px-0">
            Sending
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-none px-0">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="team" className="flex-none px-0">
            Team
          </TabsTrigger>
          <TabsTrigger value="api" className="flex-none px-0">
            API keys
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex max-w-3xl flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">One-click unsubscribe</h2>
                <p className="text-base text-secondary">
                  Off by default for cold email. Enable for bulk or newsletter-style campaigns.
                </p>
              </div>
              <Switch
                checked={settings.listUnsubscribeEnabled}
                onCheckedChange={(checked) =>
                  setSettings((current) => ({ ...current, listUnsubscribeEnabled: checked }))
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sender-name">Default sender name</Label>
                <Input
                  id="sender-name"
                  value={settings.defaultSenderName ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      defaultSenderName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="mailto">Unsubscribe mailto</Label>
                <Input
                  id="mailto"
                  value={settings.unsubscribeMailto ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      unsubscribeMailto: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="address">Physical mailing address</Label>
              <Textarea
                id="address"
                value={settings.physicalAddress ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, physicalAddress: event.target.value }))
                }
              />
              <p className="text-sm text-secondary">
                Required to send. Added to the end of every campaign email.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="footer">Unsubscribe footer</Label>
              <Textarea
                id="footer"
                value={settings.unsubscribeFooter ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, unsubscribeFooter: event.target.value }))
                }
                placeholder="Unsubscribe: {{unsubscribeUrl}}"
              />
              <p className="text-sm text-secondary">
                Must include {"{{unsubscribeUrl}}"}. Leave blank to use the example shown.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="bounce-rate">Bounce pause rate</Label>
                <Input
                  id="bounce-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.bouncePauseRate}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      bouncePauseRate: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="unsubscribe-rate">Unsubscribe pause rate</Label>
                <Input
                  id="unsubscribe-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.unsubscribePauseRate}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      unsubscribePauseRate: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="complaint-rate">Complaint pause rate</Label>
                <Input
                  id="complaint-rate"
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={settings.complaintPauseRate}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      complaintPauseRate: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <SaveBar status={status} onSave={save} />
          </section>
          <TrackingSettings />
        </TabsContent>

        <TabsContent value="sending" className="flex max-w-3xl flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-lg font-semibold">Mailbox ramp</h2>
              <p className="text-base text-secondary">
                Gradually raises real campaign volume. It does not send synthetic warmup messages.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="default-ramp">Enable for new mailboxes</Label>
                <p className="text-base text-secondary">
                  Starts new mailboxes at a conservative five campaign sends per day.
                </p>
              </div>
              <Switch
                id="default-ramp"
                checked={sending.defaultRampEnabled}
                onCheckedChange={(checked) =>
                  setSending((current) => ({ ...current, defaultRampEnabled: checked }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ramp-target">Default target per day</Label>
                <Input
                  id="ramp-target"
                  type="number"
                  min="5"
                  max="100"
                  value={sending.defaultRampTarget}
                  onChange={(event) =>
                    setSending((current) => ({
                      ...current,
                      defaultRampTarget: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="reply-reserve">Manual reply reserve</Label>
                <Input
                  id="reply-reserve"
                  type="number"
                  min="0"
                  max="10"
                  value={sending.replyReserve}
                  onChange={(event) =>
                    setSending((current) => ({
                      ...current,
                      replyReserve: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <SaveBar status={sendingStatus} onSave={saveSending} />
          </section>
          <section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-lg font-semibold">Sender domain readiness</h2>
              <p className="text-base text-secondary">
                Checks are cached. Warnings do not block cold-email launches in this milestone.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={domain}
                onChange={(event) => setDomain(event.target.value)}
                placeholder="example.com"
              />
              <Button variant="outline" onClick={checkDomain}>
                Check domain
              </Button>
            </div>

            {domainStatus ? <p className="text-base text-secondary">{domainStatus}</p> : null}
            {readiness ? (
              <div className="rounded-sm border border-border p-3 text-base text-primary">
                <p className="font-medium text-primary">
                  {readiness.status.toUpperCase()}
                  {readiness.cached ? " cached" : ""}
                </p>
                {[...readiness.issues, ...readiness.warnings].length > 0 ? (
                  <ul className="mt-2 list-disc pl-5">
                    {[...readiness.issues, ...readiness.warnings].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2">No DNS issues found.</p>
                )}
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="notifications" className="flex max-w-3xl flex-col gap-6">
          <section className="flex flex-col gap-5 rounded-lg border bg-card p-5">
            <div>
              <h2 className="text-lg font-semibold">Reply notifications</h2>
              <p className="text-base text-secondary">
                Control how new inbox replies are surfaced. Browser push is stored as a preference
                only.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="reply-in-app">In-app reply notifications</Label>
                <p className="text-base text-secondary">
                  Show new reply notifications in the header.
                </p>
              </div>
              <Switch
                id="reply-in-app"
                checked={notificationPrefs.replyInAppEnabled}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((current) => ({ ...current, replyInAppEnabled: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="reply-forward">Email forwarding</Label>
                <p className="text-base text-secondary">
                  Forward new reply summaries to these addresses.
                </p>
              </div>
              <Switch
                id="reply-forward"
                checked={notificationPrefs.replyForwardEnabled}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((current) => ({ ...current, replyForwardEnabled: checked }))
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="forward-emails">Forwarding addresses</Label>
              <Textarea
                id="forward-emails"
                value={notificationPrefs.replyForwardEmails.join("\n")}
                onChange={(event) =>
                  setNotificationPrefs((current) => ({
                    ...current,
                    replyForwardEmails: event.target.value
                      .split(/\r?\n|,/)
                      .map((item) => item.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="owner@example.com"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="browser-push">Browser push</Label>
                <p className="text-base text-secondary">
                  Delivery adapter is deferred; preference is saved.
                </p>
              </div>
              <Switch
                id="browser-push"
                checked={notificationPrefs.browserPushEnabled}
                onCheckedChange={(checked) =>
                  setNotificationPrefs((current) => ({ ...current, browserPushEnabled: checked }))
                }
              />
            </div>

            <SaveBar status={notificationStatus} onSave={saveNotificationPrefs} />
          </section>
        </TabsContent>

        <TabsContent value="team" className="flex flex-col gap-6">
          <MembersRoles />
        </TabsContent>

        <TabsContent value="api" className="flex max-w-3xl flex-col gap-6">
          <ApiKeys />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/** Save button with the last result beside it. */
function SaveBar({ status, onSave }: { status: string; onSave: () => void }) {
  const failed = /could not|error/i.test(status);
  const busy = status.startsWith("Saving");
  return (
    <div className="-mx-5 -mb-5 flex items-center justify-end gap-3 border-t bg-muted/40 px-5 py-3">
      {status ? (
        <p
          role="status"
          className={cn(
            "mr-auto flex items-center gap-1.5 text-base",
            failed ? "text-error" : "text-secondary"
          )}
        >
          {status === "Saved" ? <CheckCircle2 className="size-4 text-success" /> : null}
          {status}
        </p>
      ) : null}
      <Button onClick={onSave} disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function withoutTracking(settings: ComplianceSettings) {
  const {
    openTrackingEnabled: _open,
    clickTrackingEnabled: _click,
    ...rest
  } = settings as ComplianceSettings & {
    openTrackingEnabled?: boolean;
    clickTrackingEnabled?: boolean;
  };
  return rest;
}
