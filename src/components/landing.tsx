import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  KeyRound,
  ListChecks,
  Mailbox,
  Server,
  ShieldOff,
  Users,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Multi-step sequences",
    body: "Follow-ups that stop on reply and send inside each contact's own working hours.",
  },
  {
    icon: Mailbox,
    title: "Your own mailboxes",
    body: "Connect Google, Microsoft 365 or any SMTP and IMAP inbox, with per-mailbox daily limits.",
  },
  {
    icon: Inbox,
    title: "Unified inbox",
    body: "Every reply from every mailbox in one thread view, answered without leaving Samrian.",
  },
  {
    icon: Users,
    title: "Contacts and groups",
    body: "Import CSVs, map fields, and organise prospects into groups you can reuse.",
  },
  {
    icon: ShieldOff,
    title: "Built-in compliance",
    body: "Unsubscribe links, a do-not-contact blocklist and bounce handling out of the box.",
  },
  {
    icon: KeyRound,
    title: "API, SDK and MCP",
    body: "Drive campaigns from your own tools with a typed REST API, SDK, CLI and MCP server.",
  },
];

const PREVIEW_ROWS = [
  { name: "Q4 founders outreach", status: "Running", sent: "1,284", reply: "8.4%" },
  { name: "Agency partners", status: "Running", sent: "642", reply: "11.2%" },
  { name: "Webinar follow-up", status: "Completed", sent: "2,010", reply: "5.9%" },
];

function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-lg" aria-hidden>
      <div className="flex h-9 items-center gap-1.5 border-b bg-muted/60 px-3">
        <span className="size-2.5 rounded-full bg-border-strong/40" />
        <span className="size-2.5 rounded-full bg-border-strong/40" />
        <span className="size-2.5 rounded-full bg-border-strong/40" />
      </div>
      <div className="grid grid-cols-[150px_1fr] max-sm:grid-cols-1">
        <div className="hidden flex-col gap-1 border-r bg-body p-3 text-sm sm:flex">
          {["Overview", "Inbox", "Campaigns", "Contacts", "Mailboxes"].map((item, index) => (
            <span
              key={item}
              className={cn(
                "rounded-sm px-2 py-1.5 text-secondary",
                index === 2 && "bg-muted font-medium text-primary"
              )}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Sent", "3,936"],
              ["Reply rate", "8.1%"],
              ["Mailboxes", "4 / 4"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-3">
                <div className="text-sm text-secondary">{label}</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b px-3 py-2 text-sm text-secondary">
              <span>Campaign</span>
              <span>Status</span>
              <span className="text-right">Sent</span>
              <span className="text-right">Replies</span>
            </div>
            {PREVIEW_ROWS.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b px-3 py-2.5 text-sm last:border-0"
              >
                <span className="truncate font-medium">{row.name}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium",
                    row.status === "Running"
                      ? "bg-accent-muted text-accent"
                      : "bg-success-muted text-success"
                  )}
                >
                  <CheckCircle2 className="size-3" />
                  {row.status}
                </span>
                <span className="text-right tabular-nums">{row.sent}</span>
                <span className="text-right tabular-nums">{row.reply}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <div className="flex min-h-svh flex-col bg-body">
      <SiteHeader signedIn={signedIn} />

      <main className="flex-1">
        <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm text-secondary">
              <span className="size-1.5 rounded-full bg-success" />
              Open source · self-hostable
            </span>
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
              Cold email outreach that runs on your own infrastructure.
            </h1>
            <p className="max-w-xl text-lg leading-7 text-pretty text-secondary">
              Samrian sends personalised sequences from the mailboxes you already own, keeps every
              reply in one inbox, and stays inside each provider&apos;s limits. Host it yourself or
              run it on Vercel.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={signedIn ? "/dashboard" : "/sign-up"}
                className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}
              >
                {signedIn ? "Open dashboard" : "Get started"}
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href="#self-host"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5")}
              >
                Self-host it
              </Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section id="features" className="border-t bg-card">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-20 sm:px-6">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">
                Everything a sending team needs
              </h2>
              <p className="text-lg text-secondary">
                From the first import to the last follow-up, without handing your contacts to a
                third party.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex flex-col gap-3 bg-card p-6">
                  <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="text-base text-secondary">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="self-host" className="border-t">
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                <Server className="size-4" />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight">Up in one command</h2>
              <p className="text-lg text-secondary">
                The Docker quickstart starts the app, PostgreSQL, Redis and the delivery worker.
                Prefer serverless? Deploy to Vercel with Inngest for background jobs.
              </p>
              <ul className="flex flex-col gap-2 text-base">
                {[
                  "PostgreSQL with Drizzle migrations",
                  "BullMQ worker or Inngest functions",
                  "Encrypted mailbox credentials with key rotation",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <ListChecks className="size-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-lg border bg-inverted text-body shadow-md">
              <div className="border-b border-background/10 px-4 py-2.5 font-mono text-sm opacity-60">
                terminal
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-base leading-7">
                <code>
                  <span className="opacity-50">$ </span>bun run env:init{"\n"}
                  <span className="opacity-50">$ </span>docker compose up -d --build{"\n"}
                  <span className="opacity-50"># open http://localhost:3000</span>
                </code>
              </pre>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
