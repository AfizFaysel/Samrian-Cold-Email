import { readFile } from "node:fs/promises";

import { describe, expect, test } from "vitest";

describe("mailbox ramp architecture", () => {
  // Sending holds a reservation, so capacity is only decided when one is taken.
  test("keeps one capacity calculator across campaign and reply paths", async () => {
    const files = await Promise.all(
      ["src/server/jobs/dispatch.ts", "src/server/modules/inbox.ts"].map((file) =>
        readFile(file, "utf8")
      )
    );

    for (const source of files) {
      expect(source).toContain("getMailboxCapacity");
    }
  });

  test("does not add a synthetic warmup provider dependency", async () => {
    const packageJson = await readFile("package.json", "utf8");
    const ramp = await readFile("src/server/modules/ramp.ts", "utf8");

    expect(packageJson).not.toMatch(/warmup(inbox)?|mailwarm|lemwarm/i);
    expect(ramp).not.toMatch(/@aws-sdk|googleapis|microsoft-graph|nodemailer|inngest|bullmq/i);
  });
});
