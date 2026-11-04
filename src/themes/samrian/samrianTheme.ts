import { defineTheme } from "@astryxdesign/core/theme";
// Extend the *built* neutral theme: the package root is client-only and would
// break the server-rendered layout that loads this theme.
import { neutralTheme } from "@astryxdesign/theme-neutral/built";

/**
 * Samrian theme, identical to the ERP theme: a black-and-white base with one blue for actions.
 * Brand-neutral on purpose so it can be white-labelled: a tenant's brand
 * colour replaces only the accent tokens; everything else stays fixed.
 *
 * Roles
 * - Black: text, figures, structure. Near-black (#0a0a0a) rather than pure
 *   black: ~20:1 on white with less glare over long sessions.
 * - White: surfaces. The canvas is a step off-white so cards still separate.
 * - Grey: hairlines and secondary text only.
 * - Blue (accent): the only interactive hue. If it is blue, it can be clicked
 *   or it is selected.
 * - success / warning / error: states that need a decision, always with an
 *   icon and a word (they are similar in lightness). Never re-branded.
 *
 * Dark mode uses a true-black canvas with off-white text (#f5f5f5): pure
 * white on pure black blurs ("halation"), worst on phone OLED screens.
 *
 * Every text colour holds 4.5:1 on surface, body and muted in both modes;
 * control borders and icons hold 3:1.
 *
 * Values are [light, dark] tuples. Rebuild after editing:
 *   bunx astryx theme build src/themes/samrian/samrianTheme.ts
 */
const ink: [string, string] = ["#0a0a0a", "#f5f5f5"];
const inkSecondary: [string, string] = ["#52525b", "#a3a3a3"];
const accent: [string, string] = ["#2456c8", "#7aa2ff"];
const success: [string, string] = ["#157338", "#5ccb8a"];
const warning: [string, string] = ["#9a4d00", "#eba54e"];
const error: [string, string] = ["#c0291b", "#ff8a7a"];
const onFill: [string, string] = ["#ffffff", "#0a0a0a"];

export const samrianTheme = defineTheme({
  name: "samrian",
  extends: neutralTheme,
  // Figtree, as in the neutral theme, but bundled with next/font/local, which
  // exposes the hashed family name through --font-figtree (src/app/layout.tsx).
  typography: {
    body: {
      family: "var(--font-figtree)",
      fallbacks:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    code: {
      family: "var(--font-geist-mono)",
      fallbacks: 'ui-monospace, "SF Mono", Monaco, Consolas, monospace',
    },
  },
  // Neutral's component overrides (solid badges, status dots, progress bars)
  // read these theme-local fills instead of --color-*; point them at ours so
  // a warning bar is the same amber as a warning icon.
  localTokens: {
    "--astryx-theme-neutral-color-status-fill-accent": accent,
    "--astryx-theme-neutral-color-status-fill-success": success,
    "--astryx-theme-neutral-color-status-fill-warning": warning,
    "--astryx-theme-neutral-color-status-fill-error": error,
    "--astryx-theme-neutral-color-status-muted-accent": ["#eef3fd", "#10203f"],
  },
  tokens: {
    // Surfaces: white (light) / black (dark)
    "--color-background-body": ["#fafafa", "#000000"],
    "--color-background-surface": ["#ffffff", "#0a0a0a"],
    "--color-background-card": ["#ffffff", "#0a0a0a"],
    "--color-background-popover": ["#ffffff", "#141414"],
    "--color-background-muted": ["#f4f4f5", "#171717"],
    "--color-border": ["#e4e4e7", "#262626"],
    "--color-border-emphasized": ["#8a8a93", "#6b6b6b"],

    // Text and icons: black (light) / off-white (dark)
    "--color-text-primary": ink,
    "--color-text-secondary": inkSecondary,
    "--color-text-disabled": ["#a1a1aa", "#525252"],
    "--color-icon-primary": ink,
    "--color-icon-secondary": inkSecondary,

    // The one interactive hue. White-label: a tenant's brand replaces these five.
    "--color-accent": accent,
    "--color-accent-muted": ["#eef3fd", "#10203f"],
    "--color-on-accent": onFill,
    "--color-text-accent": accent,
    "--color-icon-accent": accent,

    // Status: done / soon / act now. Fixed across tenants.
    "--color-success": success,
    "--color-success-muted": ["#e7f4eb", "#0f2418"],
    "--color-on-success": onFill,
    "--color-text-green": success,
    "--color-warning": warning,
    "--color-warning-muted": ["#fcf0df", "#2a1c0b"],
    "--color-on-warning": onFill,
    "--color-text-yellow": warning,
    "--color-error": error,
    "--color-error-muted": ["#fbeae8", "#311614"],
    "--color-on-error": onFill,
    "--color-text-red": error,
  },
});
