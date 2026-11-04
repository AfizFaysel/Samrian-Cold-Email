"use client";

import * as React from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Selector } from "@astryxdesign/core/Selector";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Megaphone, Plus, Send, Trash2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { PageHeader, Panel } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState, RowsSkeleton } from "@/components/page-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge, StatusPill } from "@/components/status-badge";
import { Stepper } from "@/components/stepper";
import { ThemeToggle } from "@/components/theme";
import { TimePeriodSelector } from "@/components/time-period-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type Entry = {
  name: string;
  source: "Astryx" | "Samrian";
  from: string;
  note: string;
  states: Array<[label: string, node: React.ReactNode]>;
};

function Controlled({
  children,
}: {
  children: (value: string[], set: (v: string[]) => void) => React.ReactNode;
}) {
  const [value, setValue] = React.useState<string[]>(["campaigns:read"]);
  return <>{children(value, setValue)}</>;
}

function Picked() {
  const [value, setValue] = React.useState("member");
  return (
    <Selector
      label="Invite role"
      value={value}
      onChange={setValue}
      width={200}
      options={[
        { value: "owner", label: "Owner" },
        { value: "member", label: "Member" },
      ]}
    />
  );
}

export const COMPONENTS: Entry[] = [
  {
    name: "Badge",
    source: "Astryx",
    from: "@astryxdesign/core/Badge",
    note: "Solid; only for states that need action, and for counts.",
    states: [
      [
        "error",
        <Badge
          key="e"
          variant="error"
          label="Disconnected"
          icon={<Icon icon="error" size="xsm" />}
        />,
      ],
      [
        "warning",
        <Badge
          key="w"
          variant="warning"
          label="Paused"
          icon={<Icon icon="warning" size="xsm" />}
        />,
      ],
      ["count", <Badge key="c" variant="info" label="3" />],
    ],
  },
  {
    name: "StatusDot",
    source: "Astryx",
    from: "@astryxdesign/core/StatusDot",
    note: "Always next to the word. Used through StatusPill for healthy states.",
    states: (["success", "accent", "neutral", "warning", "error"] as const).map((variant) => [
      variant,
      <StatusDot key={variant} variant={variant} label={variant} />,
    ]),
  },
  {
    name: "ProgressBar",
    source: "Astryx",
    from: "@astryxdesign/core/ProgressBar",
    note: "Mailbox ramp and daily sends. Warning when over the limit.",
    states: [
      [
        "accent",
        <div key="a" className="w-48">
          <ProgressBar
            label="Ramping"
            value={25}
            max={40}
            hasValueLabel
            formatValueLabel={(v, m) => `${v} / ${m} a day`}
          />
        </div>,
      ],
      [
        "warning",
        <div key="w" className="w-48">
          <ProgressBar
            label="Sent today"
            value={25}
            max={25}
            hasValueLabel
            formatValueLabel={() => "32 / 25"}
            variant="warning"
          />
        </div>,
      ],
      [
        "empty",
        <div key="e" className="w-48">
          <ProgressBar
            label="Sent today"
            value={0}
            max={40}
            hasValueLabel
            formatValueLabel={() => "0 / 40"}
          />
        </div>,
      ],
    ],
  },
  {
    name: "Selector",
    source: "Astryx",
    from: "@astryxdesign/core/Selector",
    note: "Single choice in forms (team roles).",
    states: [
      ["default", <Picked key="s" />],
      [
        "disabled",
        <Selector
          key="d"
          label="Role"
          value="owner"
          isDisabled
          width={200}
          options={[{ value: "owner", label: "Owner" }]}
        />,
      ],
    ],
  },
  {
    name: "CheckboxList",
    source: "Astryx",
    from: "@astryxdesign/core/CheckboxList",
    note: "Groups of options (permissions, API key scopes).",
    states: [
      [
        "compact",
        <Controlled key="c">
          {(value, set) => (
            <CheckboxList label="Permissions" density="compact" value={value} onChange={set}>
              {["campaigns:read", "campaigns:write", "contacts:read"].map((p) => (
                <CheckboxListItem key={p} value={p} label={p} />
              ))}
            </CheckboxList>
          )}
        </Controlled>,
      ],
    ],
  },
  {
    name: "EmptyState",
    source: "Astryx",
    from: "@astryxdesign/core/EmptyState (via EmptyState, ErrorState)",
    note: "Empty, error and loading states for every panel.",
    states: [
      [
        "empty",
        <EmptyState
          key="e"
          icon={Megaphone}
          title="No campaigns yet"
          description="Create a campaign to start."
          action={
            <Button>
              <Plus data-icon="inline-start" />
              New campaign
            </Button>
          }
        />,
      ],
      ["error", <ErrorState key="r" title="Couldn't load campaigns" onRetry={() => {}} />],
      ["loading", <LoadingState key="l" label="Loading campaigns" />],
      [
        "rows",
        <div key="s" className="w-80">
          <RowsSkeleton rows={3} />
        </div>,
      ],
    ],
  },
  {
    name: "Icon and Text",
    source: "Astryx",
    from: "@astryxdesign/core/Icon, /Text",
    note: "Status glyphs and supporting text.",
    states: [
      [
        "icons",
        <span key="i" className="flex gap-3">
          <Icon icon="success" color="success" />
          <Icon icon="warning" color="warning" />
          <Icon icon="error" color="error" />
          <Icon icon="info" color="accent" />
        </span>,
      ],
      [
        "supporting",
        <Text key="t" type="supporting">
          Checked 4 Nov 2026
        </Text>,
      ],
    ],
  },
  {
    name: "StatusPill / StatusBadge",
    source: "Samrian",
    from: "@/components/status-badge",
    note: "Maps app statuses to StatusDot or Badge per Astryx rules.",
    states: ["active", "running", "draft", "completed", "paused", "disconnected", "bounced"].map(
      (s) => [s, <StatusBadge key={s} status={s} />]
    ),
  },
  {
    name: "Button",
    source: "Samrian",
    from: "@/components/ui/button",
    note: "shadcn button on Astryx tokens. One primary per area.",
    states: [
      [
        "primary",
        <Button key="p">
          <Send data-icon="inline-start" />
          Send
        </Button>,
      ],
      [
        "outline",
        <Button key="o" variant="outline">
          Outline
        </Button>,
      ],
      [
        "secondary",
        <Button key="s" variant="secondary">
          Secondary
        </Button>,
      ],
      [
        "ghost",
        <Button key="g" variant="ghost">
          Ghost
        </Button>,
      ],
      [
        "destructive",
        <Button key="d" variant="destructive">
          <Trash2 data-icon="inline-start" />
          Delete
        </Button>,
      ],
      [
        "link",
        <Button key="l" variant="link">
          Link
        </Button>,
      ],
      [
        "disabled",
        <Button key="x" disabled>
          Disabled
        </Button>,
      ],
      [
        "sizes",
        <span key="z" className="flex items-center gap-2">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>md</Button>
          <Button size="lg">lg</Button>
        </span>,
      ],
    ],
  },
  {
    name: "Inputs",
    source: "Samrian",
    from: "@/components/ui/input, textarea, native-select, checkbox, switch, label",
    note: "32px controls, 10px radius, 3:1 borders.",
    states: [
      [
        "input",
        <div key="i" className="flex w-56 flex-col gap-2">
          <Label htmlFor="ds-email">Email</Label>
          <Input id="ds-email" placeholder="name@company.com" />
        </div>,
      ],
      ["invalid", <Input key="v" className="w-56" aria-invalid defaultValue="not-an-email" />],
      ["disabled", <Input key="d" className="w-56" disabled defaultValue="Disabled" />],
      ["textarea", <Textarea key="t" className="w-56" placeholder="Write a reply…" />],
      [
        "native select",
        <NativeSelect key="n" className="w-56" defaultValue="ny">
          <option value="ny">America/New_York</option>
        </NativeSelect>,
      ],
      [
        "checkbox",
        <span key="c" className="flex gap-3">
          <Checkbox />
          <Checkbox defaultChecked />
        </span>,
      ],
      [
        "switch",
        <span key="w" className="flex gap-3">
          <Switch />
          <Switch defaultChecked />
        </span>,
      ],
    ],
  },
  {
    name: "Navigation",
    source: "Samrian",
    from: "@/components/ui/tabs, stepper, time-period-selector, theme",
    note: "Tabs, wizard stepper and segmented controls.",
    states: [
      [
        "tabs",
        <Tabs key="t" defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">General</TabsTrigger>
            <TabsTrigger value="b">Team</TabsTrigger>
          </TabsList>
          <TabsContent value="a" />
        </Tabs>,
      ],
      [
        "line tabs",
        <Tabs key="l" defaultValue="a">
          <TabsList variant="line">
            <TabsTrigger value="a">General</TabsTrigger>
            <TabsTrigger value="b">Team</TabsTrigger>
          </TabsList>
          <TabsContent value="a" />
        </Tabs>,
      ],
      [
        "stepper",
        <Stepper
          key="s"
          className="w-[560px]"
          current={3}
          steps={["Basics", "Schedule", "Sequence", "Contacts"].map((name, i) => ({
            id: i + 1,
            name,
          }))}
        />,
      ],
      ["period", <TimePeriodSelector key="p" value="30" onChange={() => {}} />],
      ["theme", <ThemeToggle key="m" />],
    ],
  },
  {
    name: "Page frame",
    source: "Samrian",
    from: "@/components/page-header, stat-card, logo",
    note: "Page header, panels and headline figures.",
    states: [
      [
        "header",
        <div key="h" className="w-[560px]">
          <PageHeader
            title="Campaigns"
            description="Sequences you are sending."
            breadcrumbs={[{ label: "Dashboard", href: "#" }, { label: "Campaigns" }]}
            actions={<Button>New campaign</Button>}
          />
        </div>,
      ],
      [
        "stat card",
        <StatCard
          key="s"
          className="w-56"
          label="Reply rate"
          value="7.8%"
          hint="Replies per email sent"
        />,
      ],
      ["stat loading", <StatCard key="l" className="w-56" label="Reply rate" value="" isLoading />],
      [
        "panel",
        <Panel key="p" className="w-72" title="Sending health">
          <div className="p-4">
            <StatusPill tone="success" label="2 of 3 active" />
          </div>
        </Panel>,
      ],
      ["logo", <Logo key="o" className="size-8" />],
    ],
  },
  {
    name: "Data",
    source: "Samrian",
    from: "@/components/ui/table, skeleton",
    note: "Edge-to-edge rows with dividers; 16px content line.",
    states: [
      [
        "table",
        <div key="t" className="w-[520px] rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Q4 founders outreach</TableCell>
                <TableCell>
                  <StatusBadge status="active" />
                </TableCell>
                <TableCell className="text-right tabular-nums">1,284</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Series A investors</TableCell>
                <TableCell>
                  <StatusBadge status="paused" />
                </TableCell>
                <TableCell className="text-right tabular-nums">120</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>,
      ],
      ["skeleton", <Skeleton key="s" className="h-8 w-40" />],
    ],
  },
  {
    name: "Overlays",
    source: "Samrian",
    from: "@/components/ui/dialog, confirm-dialog, sonner toaster",
    note: "Dialog surface shown inline; menus and toasts appear in the screens.",
    states: [
      [
        "dialog",
        <DialogContent key="d" className="w-96">
          <DialogHeader>
            <DialogTitle>Block an address</DialogTitle>
            <DialogDescription>No campaign will email it again.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 p-6">
            <Button variant="outline">Cancel</Button>
            <Button>Block address</Button>
          </div>
        </DialogContent>,
      ],
    ],
  },
];

export function ComponentsGallery() {
  return (
    <div className="flex flex-col gap-10">
      {COMPONENTS.map((entry) => (
        <section key={entry.name} id={slug(entry.name)} className="flex scroll-mt-6 flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-xl font-semibold">{entry.name}</h3>
            {entry.source === "Astryx" ? (
              <Badge variant="info" label="Astryx" />
            ) : (
              <Badge variant="neutral" label="Samrian" />
            )}
            <code className="font-mono text-sm text-secondary">{entry.from}</code>
          </div>
          <Text type="supporting">{entry.note}</Text>
          <div className="flex flex-wrap gap-3">
            {entry.states.map(([label, node]) => (
              <figure
                key={label}
                className="flex min-w-40 flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex min-h-10 items-center">{node}</div>
                <figcaption className="text-sm text-secondary">{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
