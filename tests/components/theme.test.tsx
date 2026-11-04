import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeToggle, applyTheme } from "../../src/components/theme";

function mockSystemDark(dark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: dark && query.includes("dark"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

beforeEach(() => {
  // Newer Node versions expose an empty global localStorage that hides jsdom's.
  vi.stubGlobal("localStorage", memoryStorage());
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  test("switches to dark and remembers the choice", () => {
    mockSystemDark(false);
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("samrian-theme")).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  test("system follows the operating system", () => {
    mockSystemDark(true);
    localStorage.setItem("samrian-theme", "light");
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: "System" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("samrian-theme")).toBe("system");
  });

  test("light removes dark mode", () => {
    mockSystemDark(true);
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});

describe("applyTheme", () => {
  test("defaults to the system setting", () => {
    mockSystemDark(true);
    applyTheme(null);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
