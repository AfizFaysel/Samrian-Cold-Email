"use client";

import * as React from "react";
import { Text } from "@astryxdesign/core/Text";

type Token = { name: string; value: string };

/** Every custom property the Astryx core and Samrian theme declare, read from the loaded CSS. */
function useTokens() {
  const [tokens, setTokens] = React.useState<Token[]>([]);
  React.useEffect(() => {
    const names = new Set<string>();
    const walk = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (
          rule instanceof CSSStyleRule &&
          /:root|:scope|data-astryx-theme/.test(rule.selectorText)
        ) {
          for (const property of rule.style) if (property.startsWith("--")) names.add(property);
        }
        if ("cssRules" in rule) walk((rule as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        // Cross-origin sheets carry no tokens.
      }
    }
    const style = getComputedStyle(document.documentElement);
    setTokens(
      [...names]
        .filter((name) => !/^--(astryx|x[a-z0-9]{4,}|tw-|_)/.test(name))
        .sort()
        .map((name) => ({ name, value: style.getPropertyValue(name).trim() }))
        .filter((token) => token.value)
    );
  }, []);
  return tokens;
}

const pick = (tokens: Token[], pattern: RegExp) =>
  tokens.filter((token) => pattern.test(token.name));

function Group({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold">{title}</h3>
        <Text type="supporting">{note}</Text>
      </div>
      {children}
    </section>
  );
}

function Name({ token }: { token: Token }) {
  return (
    <div className="min-w-0">
      <code className="block truncate font-mono text-sm">{token.name}</code>
      <span className="block truncate text-sm text-secondary">{token.value}</span>
    </div>
  );
}

const HUES = /^--color-(blue|cyan|gray|green|orange|pink|purple|red|teal|yellow)-/;

export function Foundations() {
  const tokens = useTokens();
  if (!tokens.length) return <Text type="supporting">Reading tokens…</Text>;

  const colors = pick(tokens, /^--color-/).filter(
    (t) => !HUES.test(t.name) && !/syntax|data-/.test(t.name)
  );
  const hues = pick(tokens, HUES);
  const roles = [...new Set(pick(tokens, /^--text-.+-size$/).map((t) => t.name.slice(7, -5)))];

  return (
    <div className="flex flex-col gap-12">
      <Group
        id="color"
        title="Color"
        note="Semantic tokens; each resolves per mode with light-dark()."
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {colors.map((token) => (
            <div key={token.name} className="flex items-center gap-3 rounded-md border p-2">
              <span
                className="size-9 shrink-0 rounded-sm border"
                style={{ background: `var(${token.name})` }}
              />
              <Name token={token} />
            </div>
          ))}
        </div>
        <details>
          <summary className="cursor-pointer text-base font-medium">
            Hue palette ({hues.length})
          </summary>
          <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
            {hues.map((token) => (
              <div key={token.name} className="flex items-center gap-2">
                <span
                  className="size-6 shrink-0 rounded-xs border"
                  style={{ background: `var(${token.name})` }}
                />
                <code className="truncate font-mono text-sm">{token.name}</code>
              </div>
            ))}
          </div>
        </details>
      </Group>

      <Group
        id="typography"
        title="Typography"
        note="Semantic type roles: size, weight and line height on a 4px grid."
      >
        <div className="divide-y rounded-lg border">
          {roles.map((role) => (
            <div key={role} className="grid gap-2 p-4 sm:grid-cols-[200px_1fr] sm:items-baseline">
              <code className="font-mono text-sm text-secondary">--text-{role}-*</code>
              <span
                style={{
                  fontSize: `var(--text-${role}-size)`,
                  fontWeight: `var(--text-${role}-weight)`,
                  lineHeight: `var(--text-${role}-leading)`,
                  fontFamily: role.startsWith("code") ? "var(--font-family-code)" : undefined,
                }}
              >
                Reach the right people
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {pick(tokens, /^--font-(family|weight)-/).map((token) => (
            <div key={token.name} className="rounded-md border p-3">
              <Name token={token} />
            </div>
          ))}
        </div>
      </Group>

      <Group id="spacing" title="Spacing" note="4px base unit; Tailwind p-4 equals --spacing-4.">
        <div className="flex flex-col gap-2">
          {pick(tokens, /^--spacing-/).map((token) => (
            <div key={token.name} className="grid grid-cols-[160px_1fr] items-center gap-4">
              <Name token={token} />
              <span
                className="h-3 rounded-xs bg-accent-bg"
                style={{ width: `var(${token.name})` }}
              />
            </div>
          ))}
        </div>
      </Group>

      <Group id="size" title="Size" note="Control heights shared by buttons, inputs and selectors.">
        <div className="flex flex-wrap items-end gap-6">
          {pick(tokens, /^--size-/).map((token) => (
            <div key={token.name} className="flex flex-col items-start gap-2">
              <span
                className="w-24 rounded-md border bg-muted"
                style={{ height: `var(${token.name})` }}
              />
              <Name token={token} />
            </div>
          ))}
        </div>
      </Group>

      <Group id="shape" title="Shape" note="Radius: inner, element, container, page.">
        <div className="flex flex-wrap gap-6">
          {pick(tokens, /^--radius-/).map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <span
                className="size-20 border-2 border-accent bg-accent-muted"
                style={{ borderRadius: `var(${token.name})` }}
              />
              <Name token={token} />
            </div>
          ))}
        </div>
      </Group>

      <Group id="elevation" title="Elevation" note="Cards sit on hairlines; only overlays float.">
        <div className="flex flex-wrap gap-6">
          {pick(tokens, /^--shadow-/).map((token) => (
            <div key={token.name} className="flex w-44 flex-col gap-3">
              <span
                className="h-20 rounded-lg bg-card"
                style={{ boxShadow: `var(${token.name})` }}
              />
              <code className="truncate font-mono text-sm">{token.name}</code>
            </div>
          ))}
        </div>
      </Group>

      <Group id="motion" title="Motion" note="Durations and easing curves.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pick(tokens, /^--(duration|ease)-/).map((token) => (
            <div key={token.name} className="rounded-md border p-3">
              <Name token={token} />
            </div>
          ))}
        </div>
      </Group>
    </div>
  );
}
