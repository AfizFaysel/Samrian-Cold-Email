import * as React from "react";
import Link from "next/link";
import { CalendarClock, Inbox, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const POINTS = [
  {
    icon: CalendarClock,
    title: "Sequences that respect time zones",
    body: "Steps send inside each contact's working hours, paced per mailbox.",
  },
  {
    icon: Inbox,
    title: "One inbox for every reply",
    body: "Replies from all connected mailboxes land in one place, ready to answer.",
  },
  {
    icon: ShieldCheck,
    title: "Yours to host",
    body: "Open source under AGPL-3.0. Your data stays on your infrastructure.",
  },
];

/** Sign-in and sign-up frame: the form on the left, what Samrian does on the right. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-body lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col bg-card px-6 py-6 sm:px-10">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <Logo className="size-7" />
          <span className="text-base font-semibold tracking-tight">Samrian</span>
        </Link>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="flex w-full max-w-sm flex-col gap-8">
            <header className="flex flex-col gap-1.5">
              <h1 className="text-2xl leading-8 font-semibold tracking-tight">{title}</h1>
              <p className="text-base text-secondary">{description}</p>
            </header>
            {children}
            {footer && <div className="text-base text-secondary">{footer}</div>}
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 text-sm text-secondary">
          <span>Open source under AGPL-3.0-or-later.</span>
          <Link href="/licensing" className="transition-colors hover:text-primary">
            License and source
          </Link>
        </footer>
      </div>

      <aside className="hidden border-l bg-body lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
        <div className="flex max-w-md flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-accent">Cold email, self-hosted</p>
            <p className="text-3xl leading-tight font-semibold tracking-tight text-balance">
              Reach the right people, from mailboxes you own.
            </p>
          </div>
          <ul className="flex flex-col gap-6">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-secondary" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-medium">{title}</span>
                  <span className="text-base text-secondary">{body}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-sm text-secondary">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
