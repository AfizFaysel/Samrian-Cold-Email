import { describe, expect, test, vi } from "vitest";

import { recordEvent, replyEvent, sentEvent } from "../../../src/server/modules/events";
import type { EventRepo } from "../../../src/server/ports";

describe("events module", () => {
  test("records through event repo with idempotency key", async () => {
    const repo: EventRepo = {
      record: vi.fn(async () => ({ accepted: true })),
    };

    await expect(
      recordEvent(
        sentEvent({
          orgId: "org_1",
          campaignId: "campaign_1",
          contactId: "contact_1",
          mailboxId: "mailbox_1",
          assignmentId: "assignment_1",
          messageId: "message_1",
          stepNumber: 0,
          occurredAt: 1000,
        }),
        { events: repo }
      )
    ).resolves.toEqual({ accepted: true });

    expect(repo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "sent",
        dedupeKey: "sent:assignment_1:0",
      })
    );
  });

  test("counts one reply per contact per campaign, however many threads they reply in", () => {
    const reply = (threadId: string) =>
      replyEvent({
        orgId: "org_1",
        campaignId: "campaign_1",
        contactId: "contact_1",
        threadId,
        occurredAt: 1000,
      }).dedupeKey;

    expect(reply("thread_1")).toBe(reply("thread_2"));
  });
});
