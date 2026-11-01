import { describe, expect, test } from "vitest";

import { campaignDraftSchema, contactUpdateSchema, isTimezone } from "@samrian/contracts";

const draft = { name: "Launch", steps: [{ subject: "Hi" }] };

describe("timezone input", () => {
  test("recognizes IANA zones and nothing else", () => {
    expect(isTimezone("Africa/Nairobi")).toBe(true);
    expect(isTimezone("UTC")).toBe(true);
    expect(isTimezone("Mars/Olympus")).toBe(false);
    expect(isTimezone("")).toBe(false);
  });

  test("contact updates reject an invalid timezone and still allow clearing it", () => {
    expect(contactUpdateSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
    expect(contactUpdateSchema.safeParse({ timezone: "Europe/Paris" }).success).toBe(true);
    expect(contactUpdateSchema.safeParse({ timezone: null }).success).toBe(true);
  });

  test.each(["timezone", "defaultTimezone"])("campaign drafts reject an invalid %s", (field) => {
    const parsed = campaignDraftSchema.safeParse({
      ...draft,
      schedule: { [field]: "Mars/Olympus" },
    });

    expect(parsed.success).toBe(false);
  });

  test("campaign drafts accept partial schedules", () => {
    expect(campaignDraftSchema.safeParse({ ...draft, schedule: {} }).success).toBe(true);
    expect(
      campaignDraftSchema.safeParse({
        ...draft,
        schedule: { defaultTimezone: "America/New_York" },
      }).success
    ).toBe(true);
  });
});
