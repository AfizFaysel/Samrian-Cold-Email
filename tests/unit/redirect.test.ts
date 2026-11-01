import { describe, expect, test } from "vitest";

import { safeRedirectPath } from "../../src/lib/redirect";

describe("safeRedirectPath", () => {
  test("keeps a path on this site", () => {
    expect(safeRedirectPath("?redirect=/accept-invitation/abc")).toBe("/accept-invitation/abc");
  });

  test.each([
    ["no parameter", ""],
    ["another site", "?redirect=https://evil.example"],
    ["a protocol-relative URL", "?redirect=//evil.example"],
    ["a backslash trick", "?redirect=/\\evil.example"],
    ["a relative path", "?redirect=dashboard"],
  ])("falls back for %s", (_name, search) => {
    expect(safeRedirectPath(search)).toBe("/dashboard");
  });
});
