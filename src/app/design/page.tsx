"use client";

import * as React from "react";
import { Text } from "@astryxdesign/core/Text";
import { Download, ExternalLink } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Button, buttonVariants } from "@/components/ui/button";
import { ComponentsGallery, COMPONENTS, slug } from "./components";
import { buildDesignSystemHtml, SCREENS } from "./export";
import { Foundations } from "./foundations";

const FOUNDATIONS = ["Color", "Typography", "Spacing", "Size", "Shape", "Elevation", "Motion"];
const FLOWS = [...new Set(SCREENS.map((screen) => screen.flow))];

const NAV = [
  { title: "Overview", items: [{ id: "principles", label: "Principles" }] },
  { title: "Foundations", items: FOUNDATIONS.map((f) => ({ id: f.toLowerCase(), label: f })) },
  { title: "Components", items: COMPONENTS.map((c) => ({ id: slug(c.name), label: c.name })) },
  { title: "Screens and flows", items: FLOWS.map((f) => ({ id: `flow-${slug(f)}`, label: f })) },
];

const PRINCIPLES = [
  [
    "Astryx first",
    "Use an Astryx component wherever one exists; Samrian components only fill gaps, styled with Astryx tokens.",
  ],
  [
    "One blue",
    "Black and white with one accent. If it is blue, it can be clicked or it is selected.",
  ],
  [
    "Status is a word",
    "An icon or dot plus a word, never colour alone. Badges only for states that need action.",
  ],
  [
    "Tokens, not values",
    "Colour, type, spacing, radius and elevation come from the Astryx theme; no raw hex or px.",
  ],
  [
    "One content line",
    "The container owns padding; tight gaps inside a group, generous gaps between groups.",
  ],
  ["Every state designed", "Each panel has loading, empty and error states with a way forward."],
];

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-6 flex-col gap-6 border-t pt-10 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <Text type="supporting">{lead}</Text>
      </div>
      {children}
    </section>
  );
}

function ScreenCard({ id, title, path, state }: (typeof SCREENS)[number]) {
  const [open, setOpen] = React.useState(false);
  return (
    <figure data-screen-card className="flex flex-col overflow-hidden rounded-lg border bg-card">
      <figcaption
        id={`screen-${id}`}
        className="flex items-center justify-between gap-3 border-b px-4 py-2.5"
      >
        <span className="text-base font-medium">{title}</span>
        <code className="font-mono text-sm text-secondary">
          {path}
          {state ? ` · ${state}` : ""}
        </code>
      </figcaption>
      <div data-screen-slot={id} className="bg-body">
        <div data-export-only="false" className="flex items-center gap-2 p-4">
          {open ? (
            <iframe
              title={title}
              src={path}
              className="h-[400px] w-[640px] origin-top-left scale-100 rounded-md border"
            />
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                Preview here
              </Button>
              <a
                href={path}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <ExternalLink data-icon="inline-start" />
                Open
              </a>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}

export default function DesignSystemPage() {
  const [progress, setProgress] = React.useState("");

  React.useEffect(() => {
    // Lets local tooling build the file without clicking.
    (window as unknown as { __designExport: typeof buildDesignSystemHtml }).__designExport =
      buildDesignSystemHtml;
  }, []);

  async function exportHtml() {
    const html = await buildDesignSystemHtml(setProgress);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    link.download = "samrian-design-system.html";
    link.click();
    // Through scripts/design/preview.ts the file also lands in docs/design-system.html.
    await fetch("/__save", { method: "POST", body: html }).catch(() => undefined);
    setProgress("");
  }

  return (
    <div className="grid min-h-svh bg-body lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b bg-body lg:sticky lg:top-0 lg:h-svh lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <Logo className="size-7" />
          <div className="flex flex-col">
            <span className="text-base font-semibold">Samrian</span>
            <span className="text-sm text-secondary">Design system</span>
          </div>
        </div>
        <nav className="flex flex-col gap-4 px-3 pb-6">
          {NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <span className="px-2 pb-1 text-sm font-medium text-secondary">{group.title}</span>
              {group.items.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-sm px-2 py-1.5 text-base hover:bg-muted"
                >
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-col gap-10 p-4 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Samrian design system</h1>
            <Text type="supporting">
              Built on Astryx with the Samrian theme. Foundations are read live from the theme,
              components render in their real states, and screens are the app itself.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span data-export-only="false" className="flex items-center gap-2">
              {progress ? <Text type="supporting">{progress}</Text> : null}
              <Button onClick={exportHtml} disabled={Boolean(progress)}>
                <Download data-icon="inline-start" />
                Export HTML
              </Button>
            </span>
          </div>
        </header>

        <Section id="principles" title="Principles" lead="The rules every screen follows.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(([title, body]) => (
              <div key={title} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
                <span className="text-base font-semibold">{title}</span>
                <Text type="supporting">{body}</Text>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="foundations"
          title="Foundations"
          lead="Astryx tokens resolved through the Samrian theme."
        >
          <Foundations />
        </Section>

        <Section
          id="components"
          title="Components"
          lead="Every Astryx and Samrian component the app uses, in its states."
        >
          <ComponentsGallery />
        </Section>

        <Section
          id="screens"
          title="Screens and flows"
          lead="Every screen and flow step, captured from the running app as HTML."
        >
          {FLOWS.map((flow) => (
            <div key={flow} id={`flow-${slug(flow)}`} className="flex scroll-mt-6 flex-col gap-3">
              <h3 className="text-xl font-semibold">{flow}</h3>
              <div className="grid gap-4 xl:grid-cols-2">
                {SCREENS.filter((screen) => screen.flow === flow).map((screen) => (
                  <ScreenCard key={screen.id} {...screen} />
                ))}
              </div>
            </div>
          ))}
        </Section>
      </main>
    </div>
  );
}
