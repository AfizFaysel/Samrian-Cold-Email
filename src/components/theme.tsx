"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Icon } from "@astryxdesign/core/Icon";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";

export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "samrian-theme";
const CHANGE_EVENT = "samrian-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before first paint (inlined in the root layout) so a dark-mode reader never sees a
 * white flash. Keep it in step with applyTheme.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice | null) {
  const systemDark =
    typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
  const dark = choice === "dark" || (choice !== "light" && systemDark);
  // Astryx tokens use light-dark(); html[data-theme] pins the color-scheme they resolve with.
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
  const onSystemChange = () => {
    if (readChoice() === "system") applyTheme("system");
    onChange();
  };
  media?.addEventListener?.("change", onSystemChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media?.removeEventListener?.("change", onSystemChange);
  };
}

export function useTheme() {
  const theme = React.useSyncExternalStore(subscribe, readChoice, () => "system" as const);

  const setTheme = React.useCallback((choice: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    applyTheme(choice);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  /** What is on screen now, with "system" resolved. */
  const resolved: "light" | "dark" =
    theme === "system"
      ? typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia(DARK_QUERY).matches
        ? "dark"
        : "light"
      : theme;

  return { theme, resolved, setTheme };
}

export const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light, dark or follow the system. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      size="sm"
      value={theme}
      onChange={(value) => setTheme(value as ThemeChoice)}
    >
      {THEME_OPTIONS.map(({ value, label, icon }) => (
        <SegmentedControlItem
          key={value}
          value={value}
          label={label}
          isLabelHidden
          icon={<Icon icon={icon} />}
        />
      ))}
    </SegmentedControl>
  );
}
