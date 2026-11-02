import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import { purgeOrganization } from "../../src/server/data/purge-org";
import { createDb } from "../../src/server/db/db";
import { TENANT_TABLES } from "../../src/server/db/rls";
import {
  blocklist,
  contacts,
  invitations,
  mailboxes,
  members,
  notifications,
  organizations,
  threads,
} from "../../src/server/db/schema";

const adminUrl = process.env.TEST_DATABASE_URL;
const orgId = "org_purge";
const otherOrg = "org_purge_other";

describe.skipIf(!adminUrl)("purging an organization", () => {
  const db = createDb({ driver: "postgres-js", url: adminUrl! }).client;

  async function seed(id: string) {
    await db.insert(organizations).values({ id, name: id, slug: id });
    await db.insert(members).values({
      id: `${id}_member`,
      organizationId: id,
      userId: "user_1",
      role: "owner",
    });
    await db.insert(invitations).values({
      id: `${id}_invite`,
      organizationId: id,
      email: "new@example.com",
      role: "member",
      status: "pending",
      expiresAt: new Date(),
      inviterId: "user_1",
    });
    await db
      .insert(contacts)
      .values({ id: `${id}_contact`, orgId: id, email: "lead@example.com", customVars: {} });
    await db.insert(mailboxes).values({
      id: `${id}_mailbox`,
      orgId: id,
      name: "Sender",
      provider: "smtp",
      dailySendLimit: 50,
      encryptedPassword: "secret",
    });
    await db.insert(threads).values({
      id: `${id}_thread`,
      orgId: id,
      campaignId: "",
      contactId: "",
      mailboxId: "",
      messageId: `${id}_message`,
      direction: "sent",
      from: "",
      to: [],
      subject: "Hi",
    });
    await db.insert(notifications).values({ id: `${id}_n`, orgId: id, type: "reply", title: "N" });
    await db
      .insert(blocklist)
      .values({ id: `${id}_block`, orgId: id, email: "stop@example.com", reason: "unsubscribed" });
  }

  async function clean() {
    for (const id of [orgId, otherOrg]) await purgeOrganization(db, id, { confirm: true });
  }

  const rows = async (id: string) => ({
    organizations: await db.select().from(organizations).where(eq(organizations.id, id)),
    members: await db.select().from(members).where(eq(members.organizationId, id)),
    contacts: await db.select().from(contacts).where(eq(contacts.orgId, id)),
    mailboxes: await db.select().from(mailboxes).where(eq(mailboxes.orgId, id)),
    threads: await db.select().from(threads).where(eq(threads.orgId, id)),
  });

  beforeEach(clean);
  afterAll(clean);

  test("every table holding organization data is covered", async () => {
    const result = await db.execute(
      sql`select table_name from information_schema.columns
          where table_schema = 'public' and column_name = 'org_id'`
    );
    const tables = (result as unknown as Array<{ table_name: string }>).map(
      (row) => row.table_name
    );

    expect(tables.sort()).toEqual([...TENANT_TABLES].sort());
  });

  test("a dry run counts and deletes nothing", async () => {
    await seed(orgId);

    const counts = await purgeOrganization(db, orgId);

    expect(counts).toMatchObject({ contacts: 1, mailboxes: 1, members: 1, organizations: 1 });
    expect((await rows(orgId)).contacts).toHaveLength(1);
  });

  test("removes everything for the organization and leaves others alone", async () => {
    await seed(orgId);
    await seed(otherOrg);

    await purgeOrganization(db, orgId, { confirm: true });

    await expect(rows(orgId)).resolves.toEqual({
      organizations: [],
      members: [],
      contacts: [],
      mailboxes: [],
      threads: [],
    });
    const other = await rows(otherOrg);
    expect(other.organizations).toHaveLength(1);
    expect(other.mailboxes).toHaveLength(1);
  });
});
