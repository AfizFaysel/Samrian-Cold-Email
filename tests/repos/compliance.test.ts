import { beforeEach, describe, expect, test } from "vitest";
import { eq } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { orgSettings, senderDomains } from "../../src/server/db/schema";
import { PostgresDomainRepo, PostgresSettingsRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres compliance repos", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const settings = new PostgresSettingsRepo(db);
  const domains = new PostgresDomainRepo(db);

  beforeEach(async () => {
    await db.delete(senderDomains).where(eq(senderDomains.orgId, "org_compliance"));
    await db.delete(orgSettings).where(eq(orgSettings.orgId, "org_compliance"));
  });

  test("upserts compliance settings with List-Unsubscribe default off", async () => {
    await expect(settings.getCompliance("org_compliance")).resolves.toMatchObject({
      listUnsubscribeEnabled: false,
      clickTrackingEnabled: false,
      openTrackingEnabled: false,
    });

    await settings.upsertCompliance("org_compliance", {
      listUnsubscribeEnabled: true,
      clickTrackingEnabled: true,
      openTrackingEnabled: true,
      physicalAddress: "1 Main St",
      unsubscribeFooter: "Unsubscribe: {{unsubscribeUrl}}",
      unsubscribeMailto: "unsubscribe@example.com",
      bouncePauseRate: 0.05,
      unsubscribePauseRate: 0.1,
    });

    await expect(settings.getCompliance("org_compliance")).resolves.toMatchObject({
      listUnsubscribeEnabled: true,
      clickTrackingEnabled: true,
      openTrackingEnabled: true,
      physicalAddress: "1 Main St",
      unsubscribeFooter: "Unsubscribe: {{unsubscribeUrl}}",
    });
  });

  test("a partial update leaves every other setting alone", async () => {
    await settings.upsertCompliance("org_compliance", {
      listUnsubscribeEnabled: true,
      physicalAddress: "1 Main St",
      unsubscribeFooter: "Unsubscribe: {{unsubscribeUrl}}",
      bouncePauseRate: 0.02,
    });

    await settings.upsertCompliance("org_compliance", { openTrackingEnabled: true });
    await settings.upsertCompliance("org_compliance", {});

    await expect(settings.getCompliance("org_compliance")).resolves.toMatchObject({
      listUnsubscribeEnabled: true,
      openTrackingEnabled: true,
      physicalAddress: "1 Main St",
      unsubscribeFooter: "Unsubscribe: {{unsubscribeUrl}}",
      bouncePauseRate: 0.02,
    });
  });

  test("a first partial write keeps the defaults", async () => {
    await settings.upsertCompliance("org_compliance", { physicalAddress: "1 Main St" });

    await expect(settings.getCompliance("org_compliance")).resolves.toMatchObject({
      listUnsubscribeEnabled: false,
      physicalAddress: "1 Main St",
      bouncePauseRate: 0.05,
    });
  });

  test("an explicit null clears a setting", async () => {
    await settings.upsertCompliance("org_compliance", { physicalAddress: "1 Main St" });

    await settings.upsertCompliance("org_compliance", { physicalAddress: null });

    expect((await settings.getCompliance("org_compliance")).physicalAddress).toBeNull();
  });

  test("stores latest sender domain readiness result", async () => {
    await domains.upsert({
      orgId: "org_compliance",
      domain: "example.com",
      source: "dns",
      status: "warn",
      checks: { mx: "pass", spf: "warn", dmarc: "warn", dkim: "warn" },
      issues: [],
      warnings: ["SPF record not found"],
      checkedAt: 123,
    });

    await expect(domains.get("org_compliance", "example.com")).resolves.toMatchObject({
      domain: "example.com",
      status: "warn",
      warnings: ["SPF record not found"],
    });
  });
});
