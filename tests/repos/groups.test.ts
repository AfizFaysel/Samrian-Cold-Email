import { beforeEach, describe, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { createDb } from "../../src/server/db/db";
import { contactGroups, contacts } from "../../src/server/db/schema";
import { PostgresContactRepo, PostgresGroupRepo } from "../../src/server/repos";

const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)("postgres group repo", () => {
  const db = createDb({ driver: "postgres-js", url: testUrl! }).client;
  const contactsRepo = new PostgresContactRepo(db);
  const groupsRepo = new PostgresGroupRepo(db);

  beforeEach(async () => {
    const orgIds = ["org_groups", "org_groups_other"];
    await db.delete(contactGroups).where(inArray(contactGroups.orgId, orgIds));
    await db.delete(contacts).where(inArray(contacts.orgId, orgIds));
  });

  const dynamicGroup = () =>
    groupsRepo.create({
      orgId: "org_groups",
      name: "Example",
      rules: [{ field: "domain", operator: "equals", value: "example.com" }],
      logic: "AND",
      isDynamic: true,
      createdBy: "user_1",
    });

  test("finds matches beyond the first 10,000 contacts", async () => {
    await db.insert(contacts).values(
      Array.from({ length: 10_100 }, (_, index) => ({
        id: `contact_${String(index).padStart(6, "0")}`,
        orgId: "org_groups",
        email: `c${index}@${index >= 10_095 ? "example.com" : "other.com"}`,
        domain: index >= 10_095 ? "example.com" : "other.com",
        customVars: {},
      }))
    );
    const group = await dynamicGroup();

    await expect(groupsRepo.countContacts(group.id, "org_groups")).resolves.toBe(5);
    await expect(groupsRepo.resolveContactIds(group.id, "org_groups")).resolves.toHaveLength(5);
  });

  test("a partial update is validated against what is stored", async () => {
    const group = await dynamicGroup();

    await expect(groupsRepo.update(group.id, "org_groups", { rules: {} })).rejects.toThrow(
      "Dynamic groups need at least one rule"
    );
    await expect(groupsRepo.update(group.id, "org_groups", { rules: [] })).rejects.toThrow(
      "Dynamic groups need at least one rule"
    );

    await expect(
      groupsRepo.update(group.id, "org_groups", { name: "Renamed" })
    ).resolves.toMatchObject({ name: "Renamed", isDynamic: true, rules: [expect.anything()] });
  });

  test("a static group cannot become dynamic without rules", async () => {
    const group = await groupsRepo.create({
      orgId: "org_groups",
      name: "Static",
      rules: [],
      logic: "AND",
      isDynamic: false,
      createdBy: "user_1",
    });

    await expect(groupsRepo.update(group.id, "org_groups", { isDynamic: true })).rejects.toThrow(
      "Dynamic groups need at least one rule"
    );
  });

  test("an empty update changes nothing", async () => {
    const group = await dynamicGroup();

    await expect(groupsRepo.update(group.id, "org_groups", {})).resolves.toMatchObject({
      id: group.id,
    });
  });

  test("a stored group with broken rules matches nobody, not everybody", async () => {
    await contactsRepo.create({ orgId: "org_groups", email: "ada@example.com" });
    const group = await dynamicGroup();
    await db.update(contactGroups).set({ rules: {} }).where(eq(contactGroups.id, group.id));

    await expect(groupsRepo.resolveContactIds(group.id, "org_groups")).resolves.toEqual([]);
    await expect(groupsRepo.countContacts(group.id, "org_groups")).resolves.toBe(0);
  });

  test("static groups count distinct contacts that exist here", async () => {
    const mine = await contactsRepo.create({ orgId: "org_groups", email: "ada@example.com" });
    const foreign = await contactsRepo.create({
      orgId: "org_groups_other",
      email: "grace@example.com",
    });
    const group = await groupsRepo.create({
      orgId: "org_groups",
      name: "Static",
      rules: [],
      logic: "AND",
      isDynamic: false,
      contactIds: [mine.id, mine.id, foreign.id, "contact_missing"],
      createdBy: "user_1",
    });

    expect(group.contactIds).toEqual([mine.id, foreign.id, "contact_missing"]);
    await expect(groupsRepo.countContacts(group.id, "org_groups")).resolves.toBe(1);
    await expect(groupsRepo.resolveContactIds(group.id, "org_groups")).resolves.toEqual([mine.id]);
  });

  test("counts, samples, and resolves dynamic groups with org isolation", async () => {
    await contactsRepo.create({
      orgId: "org_groups",
      email: "Ada@Example.com",
      customVars: { role: "cto" },
      timezone: "UTC",
    });
    await contactsRepo.create({
      orgId: "org_groups",
      email: "Grace@Test.com",
      customVars: { role: "engineer" },
      timezone: "Africa/Nairobi",
    });
    await contactsRepo.create({ orgId: "org_groups_other", email: "ada@example.com" });

    const group = await groupsRepo.create({
      orgId: "org_groups",
      name: "Example",
      rules: [{ field: "domain", operator: "equals", value: "example.com" }],
      logic: "AND",
      isDynamic: true,
      createdBy: "user_1",
    });

    await expect(groupsRepo.countContacts(group.id, "org_groups")).resolves.toBe(1);
    await expect(groupsRepo.sampleContacts(group.id, "org_groups", 10)).resolves.toHaveLength(1);
    await expect(groupsRepo.resolveContactIds(group.id, "org_groups", 10)).resolves.toHaveLength(1);
  });
});
