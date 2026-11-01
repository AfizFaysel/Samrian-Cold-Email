import { afterEach, describe, expect, test } from "vitest";

import {
  createUnsubscribeToken,
  unsubscribeContact,
  verifyUnsubscribeToken,
} from "../../../src/server/modules/unsubscribe";

const original = process.env.UNSUBSCRIBE_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.UNSUBSCRIBE_SECRET;
  else process.env.UNSUBSCRIBE_SECRET = original;
});

describe("unsubscribe tokens", () => {
  test("a tampered link is an expected failure, not a server error", async () => {
    process.env.UNSUBSCRIBE_SECRET = "a".repeat(32);

    await expect(
      unsubscribeContact({ contactId: "contact_1", campaignId: "campaign_1", token: "bad.token" })
    ).resolves.toEqual({ success: false, message: "This unsubscribe link is not valid." });
  });

  test("a missing secret stays a server error", async () => {
    delete process.env.UNSUBSCRIBE_SECRET;

    await expect(
      unsubscribeContact({ contactId: "contact_1", campaignId: "campaign_1", token: "bad.token" })
    ).rejects.toThrow("UNSUBSCRIBE_SECRET is required");
  });

  test("uses dedicated secret so rotation invalidates old tokens", () => {
    process.env.UNSUBSCRIBE_SECRET = "a".repeat(32);
    const token = createUnsubscribeToken({
      orgId: "org_1",
      contactId: "contact_1",
      campaignId: "campaign_1",
    });

    process.env.UNSUBSCRIBE_SECRET = "b".repeat(32);
    expect(() =>
      verifyUnsubscribeToken(token, {
        contactId: "contact_1",
        campaignId: "campaign_1",
      })
    ).toThrow("Invalid unsubscribe token");
  });
});
