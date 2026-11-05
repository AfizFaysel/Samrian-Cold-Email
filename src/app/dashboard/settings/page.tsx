"use client";

import * as React from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";

import { ApiKeys } from "@/components/api-keys";
import { MembersRoles } from "@/components/members-roles";
import { Page } from "@/components/page-header";
import { SaveBar, SettingsCard, type SaveState } from "@/components/settings-card";
import { TrackingSettings } from "@/components/tracking-settings";
import { errorMessage, requestJson } from "@/lib/request";

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

type TabId = "general" | "sending" | "notifications" | "team" | "api";

const TABS: Array<{ value: TabId; label: string }> = [
  { value: "general", label: "General" },
  { value: "sending", label: "Sending" },
  { value: "notifications", label: "Notifications" },
  { value: "team", label: "Team" },
  { value: "api", label: "API keys" },
];

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

const IDLE: SaveState = { kind: "idle" };

// Pause rates are stored as fractions (0.05) but read and typed as percentages (5%).
const toPercent = (fraction: number) => Math.round(fraction * 1000) / 10;
const toFraction = (percent: number) => Math.round(percent * 10) / 1000;

export default function SettingsPage() {
  const [tab, setTab] = React.useState<TabId>("general");
  const [settings, setSettings] = React.useState<ComplianceSettings>(fallbackSettings);
  const [generalState, setGeneralState] = React.useState<SaveState>(IDLE);
  const [pauseState, setPauseState] = React.useState<SaveState>(IDLE);
  const [domain, setDomain] = React.useState("");
  const [readiness, setReadiness] = React.useState<DomainReadiness | null>(null);
  const [domainError, setDomainError] = React.useState("");
  const [isChecking, setIsChecking] = React.useState(false);
  const [notificationPrefs, setNotificationPrefs] =
    React.useState<NotificationPrefs>(fallbackNotificationPrefs);
  // Raw text so a trailing comma or new line survives typing; parsed into addresses on save.
  const [forwardText, setForwardText] = React.useState("");
  const [notificationState, setNotificationState] = React.useState<SaveState>(IDLE);
  const [sending, setSending] = React.useState<SendingSettings>(fallbackSendingSettings);
  const [sendingState, setSendingState] = React.useState<SaveState>(IDLE);

  React.useEffect(() => {
    requestJson<Partial<ComplianceSettings>>("/api/settings/compliance")
      .then((data) => setSettings({ ...fallbackSettings, ...data }))
      .catch((error) => setGeneralState({ kind: "error", message: errorMessage(error) }));

    requestJson<Partial<NotificationPrefs>>("/api/settings/notifications")
      .then((data) => {
        const prefs = { ...fallbackNotificationPrefs, ...data };
        setNotificationPrefs(prefs);
        setForwardText(prefs.replyForwardEmails.join("\n"));
      })
      .catch((error) => setNotificationState({ kind: "error", message: errorMessage(error) }));

    requestJson<Partial<SendingSettings>>("/api/settings/sending")
      .then((data) => setSending({ ...fallbackSendingSettings, ...data }))
      .catch((error) => setSendingState({ kind: "error", message: errorMessage(error) }));
  }, []);

  const updateSettings = (patch: Partial<ComplianceSettings>) =>
    setSettings((current) => ({ ...current, ...patch }));

  // Both compliance cards save the same settings record; each shows its own result.
  async function save(setState: (state: SaveState) => void) {
    setState({ kind: "saving" });
    try {
      const saved = await requestJson<Partial<ComplianceSettings>>("/api/settings/compliance", {
        method: "PATCH",
        // Tracking saves on its own switches; never resend the values loaded with this form.
        body: JSON.stringify(withoutTracking(settings)),
      });
      setSettings({ ...fallbackSettings, ...saved });
      setState({ kind: "saved" });
    } catch (error) {
      setState({ kind: "error", message: errorMessage(error) });
    }
  }

  async function checkDomain() {
    if (!domain.trim()) return;
    setIsChecking(true);
    setDomainError("");
    try {
      setReadiness(
        await requestJson(`/api/domains/check?domain=${encodeURIComponent(domain.trim())}`)
      );
    } catch (error) {
      setReadiness(null);
      setDomainError(errorMessage(error));
    } finally {
      setIsChecking(false);
    }
  }

  async function saveNotificationPrefs() {
    setNotificationState({ kind: "saving" });
    try {
      const saved = await requestJson<Partial<NotificationPrefs>>("/api/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify({
          ...notificationPrefs,
          replyForwardEmails: forwardText
            .split(/\r?\n|,/)
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const prefs = { ...fallbackNotificationPrefs, ...saved };
      setNotificationPrefs(prefs);
      setForwardText(prefs.replyForwardEmails.join("\n"));
      setNotificationState({ kind: "saved" });
    } catch (error) {
      setNotificationState({ kind: "error", message: errorMessage(error) });
    }
  }

  async function saveSending() {
    setSendingState({ kind: "saving" });
    try {
      const saved = await requestJson<Partial<SendingSettings>>("/api/settings/sending", {
        method: "PATCH",
        body: JSON.stringify(sending),
      });
      setSending({ ...fallbackSendingSettings, ...saved });
      setSendingState({ kind: "saved" });
    } catch (error) {
      setSendingState({ kind: "error", message: errorMessage(error) });
    }
  }

  const findings = readiness ? [...readiness.issues, ...readiness.warnings] : [];

  return (
    <Page title="Settings" description="Compliance, sending limits, notifications and your team.">
      <TabList role="tablist" value={tab} onChange={(value) => setTab(value as TabId)}>
        {TABS.map((item) => (
          <Tab
            key={item.value}
            value={item.value}
            label={item.label}
            panelId={`settings-${item.value}`}
          />
        ))}
      </TabList>

      <VStack
        id={`settings-${tab}`}
        role="tabpanel"
        gap={6}
        maxWidth={tab === "team" ? undefined : 768}
      >
        {tab === "general" ? (
          <>
            <SettingsCard
              title="Compliance"
              description="What every campaign email carries so it stays legal and easy to opt out of."
              footer={<SaveBar state={generalState} onSave={() => void save(setGeneralState)} />}
            >
              <TextArea
                label="Physical mailing address"
                description="Required to send. Added to the end of every campaign email."
                width="100%"
                rows={2}
                value={settings.physicalAddress ?? ""}
                onChange={(value) => updateSettings({ physicalAddress: value })}
                isRequired
              />
              <TextArea
                label="Unsubscribe footer"
                description="Must include {{unsubscribeUrl}}. Leave blank to use the example shown."
                width="100%"
                rows={2}
                value={settings.unsubscribeFooter ?? ""}
                onChange={(value) => updateSettings({ unsubscribeFooter: value })}
                placeholder="Unsubscribe: {{unsubscribeUrl}}"
              />
              <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={4}>
                <TextInput
                  label="Default sender name"
                  description="The From name when a mailbox has none."
                  width="100%"
                  value={settings.defaultSenderName ?? ""}
                  onChange={(value) => updateSettings({ defaultSenderName: value })}
                />
                <TextInput
                  label="Unsubscribe mailto"
                  description="Where emailed opt-outs go."
                  type="email"
                  width="100%"
                  value={settings.unsubscribeMailto ?? ""}
                  onChange={(value) => updateSettings({ unsubscribeMailto: value })}
                />
              </Grid>
              <Switch
                label="One-click unsubscribe"
                description="Off by default for cold email. Turn on for bulk or newsletter-style campaigns."
                labelPosition="start"
                labelSpacing="spread"
                width="100%"
                value={settings.listUnsubscribeEnabled}
                onChange={(checked) => updateSettings({ listUnsubscribeEnabled: checked })}
              />
            </SettingsCard>

            <SettingsCard
              title="Auto-pause"
              description="A campaign pauses itself when any of these rates is reached, to protect your sending domains."
              footer={<SaveBar state={pauseState} onSave={() => void save(setPauseState)} />}
            >
              <Grid columns={{ minWidth: 180, repeat: "fit" }} gap={4}>
                <NumberInput
                  label="Bounce rate"
                  width="100%"
                  value={toPercent(settings.bouncePauseRate)}
                  onChange={(value) => updateSettings({ bouncePauseRate: toFraction(value) })}
                  min={0}
                  max={100}
                  step={0.5}
                  units="%"
                />
                <NumberInput
                  label="Unsubscribe rate"
                  width="100%"
                  value={toPercent(settings.unsubscribePauseRate)}
                  onChange={(value) => updateSettings({ unsubscribePauseRate: toFraction(value) })}
                  min={0}
                  max={100}
                  step={0.5}
                  units="%"
                />
                <NumberInput
                  label="Spam complaint rate"
                  width="100%"
                  value={toPercent(settings.complaintPauseRate)}
                  onChange={(value) => updateSettings({ complaintPauseRate: toFraction(value) })}
                  min={0}
                  max={100}
                  step={0.1}
                  units="%"
                />
              </Grid>
            </SettingsCard>

            <TrackingSettings />
          </>
        ) : null}

        {tab === "sending" ? (
          <>
            <SettingsCard
              title="Mailbox ramp"
              description="Gradually raises real campaign volume. It does not send synthetic warmup messages."
              footer={<SaveBar state={sendingState} onSave={saveSending} />}
            >
              <Switch
                label="Enable for new mailboxes"
                description="Starts new mailboxes at a conservative five campaign sends a day."
                labelPosition="start"
                labelSpacing="spread"
                width="100%"
                value={sending.defaultRampEnabled}
                onChange={(checked) =>
                  setSending((current) => ({ ...current, defaultRampEnabled: checked }))
                }
              />
              <Grid columns={{ minWidth: 200, repeat: "fit" }} gap={4}>
                <NumberInput
                  label="Default target per day"
                  description="Where the ramp stops climbing."
                  width="100%"
                  value={sending.defaultRampTarget}
                  onChange={(value) =>
                    setSending((current) => ({ ...current, defaultRampTarget: value }))
                  }
                  min={5}
                  max={100}
                  isIntegerOnly
                  units="a day"
                />
                <NumberInput
                  label="Manual reply reserve"
                  description="Sends kept free each day for your own replies."
                  width="100%"
                  value={sending.replyReserve}
                  onChange={(value) =>
                    setSending((current) => ({ ...current, replyReserve: value }))
                  }
                  min={0}
                  max={10}
                  isIntegerOnly
                />
              </Grid>
            </SettingsCard>

            <SettingsCard
              title="Sender domain check"
              description="Looks up the DNS records that decide whether your email lands in the inbox."
            >
              <HStack gap={2} vAlign="end" wrap="wrap">
                <TextInput
                  label="Domain"
                  width={280}
                  value={domain}
                  onChange={setDomain}
                  onEnter={() => void checkDomain()}
                  placeholder="example.com"
                />
                <Button
                  label="Check domain"
                  variant="secondary"
                  isLoading={isChecking}
                  isDisabled={!domain.trim()}
                  onClick={() => void checkDomain()}
                />
              </HStack>
              {domainError ? <Banner status="error" title={domainError} /> : null}
              {readiness ? (
                <Banner
                  status={
                    readiness.status === "pass"
                      ? "success"
                      : readiness.status === "warn"
                        ? "warning"
                        : "info"
                  }
                  title={
                    readiness.status === "pass"
                      ? "No DNS problems found"
                      : readiness.status === "warn"
                        ? `${findings.length} thing${findings.length === 1 ? "" : "s"} to fix before sending at volume`
                        : "Couldn't check every record"
                  }
                  description={
                    readiness.cached ? "From a check in the last few minutes." : undefined
                  }
                  collapsible={false}
                >
                  {findings.length > 0 ? (
                    <List density="compact">
                      {findings.map((item) => (
                        <ListItem key={item} label={item} />
                      ))}
                    </List>
                  ) : undefined}
                </Banner>
              ) : null}
            </SettingsCard>
          </>
        ) : null}

        {tab === "notifications" ? (
          <SettingsCard
            title="Reply notifications"
            description="How you hear about new replies."
            footer={<SaveBar state={notificationState} onSave={saveNotificationPrefs} />}
          >
            <Switch
              label="In-app notifications"
              description="Show new replies in the bell at the top of the sidebar."
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              value={notificationPrefs.replyInAppEnabled}
              onChange={(checked) =>
                setNotificationPrefs((current) => ({ ...current, replyInAppEnabled: checked }))
              }
            />
            <Switch
              label="Email forwarding"
              description="Send a summary of each new reply to the addresses below."
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              value={notificationPrefs.replyForwardEnabled}
              onChange={(checked) =>
                setNotificationPrefs((current) => ({ ...current, replyForwardEnabled: checked }))
              }
            />
            <TextArea
              label="Forwarding addresses"
              description="One per line, or separated by commas."
              width="100%"
              rows={3}
              value={forwardText}
              onChange={setForwardText}
              placeholder="owner@example.com"
              isDisabled={!notificationPrefs.replyForwardEnabled}
            />
            <Switch
              label="Browser notifications"
              description="Not available yet. Your choice is kept for when it is."
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              value={notificationPrefs.browserPushEnabled}
              onChange={(checked) =>
                setNotificationPrefs((current) => ({ ...current, browserPushEnabled: checked }))
              }
            />
          </SettingsCard>
        ) : null}

        {tab === "team" ? <MembersRoles /> : null}
        {tab === "api" ? <ApiKeys /> : null}
      </VStack>
    </Page>
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
