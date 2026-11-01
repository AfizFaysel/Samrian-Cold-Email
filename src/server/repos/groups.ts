import { and, eq } from "drizzle-orm";

import { contactGroups } from "../db/schema";
import {
  GROUP_AUDIENCE_LIMIT,
  GroupRulesError,
  matchContactGroup,
  validateGroupDefinition,
  type GroupRule,
} from "../modules/groups";
import type { DbExecutor } from "../db/tx";
import type { OrgId } from "../ports";
import { PostgresContactRepo } from "./contacts";
import { newId } from "./ids";

export type ContactGroupRecord = {
  id: string;
  orgId: OrgId;
  name: string;
  rules: unknown;
  logic: "AND" | "OR";
  isDynamic: boolean;
  contactIds?: string[];
};

export type CreateContactGroupInput = Omit<ContactGroupRecord, "id"> & {
  createdBy: string;
  description?: string | null;
};

export type UpdateContactGroupInput = {
  name?: string;
  rules?: unknown;
  logic?: "AND" | "OR";
  isDynamic?: boolean;
  contactIds?: string[];
  description?: string | null;
};

const SCAN_PAGE_SIZE = 1000;

export class PostgresGroupRepo {
  constructor(private readonly db: DbExecutor) {}

  async create(input: CreateContactGroupInput): Promise<ContactGroupRecord> {
    validateGroupInput(input);
    const [row] = await this.db
      .insert(contactGroups)
      .values({
        id: newId("group"),
        orgId: input.orgId,
        name: input.name,
        description: input.description,
        rules: input.rules,
        logic: input.logic,
        isDynamic: input.isDynamic,
        contactIds: unique(input.contactIds),
        createdBy: input.createdBy,
      })
      .returning();
    return toGroup(row);
  }

  async update(
    id: string,
    orgId: OrgId,
    input: UpdateContactGroupInput
  ): Promise<ContactGroupRecord | null> {
    const existing = await this.getById(id, orgId);
    if (!existing) return null;
    validateGroupInput({
      rules: input.rules ?? existing.rules,
      logic: input.logic ?? existing.logic,
      isDynamic: input.isDynamic ?? existing.isDynamic,
    });
    if (Object.keys(input).length === 0) return existing;

    const [row] = await this.db
      .update(contactGroups)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.rules !== undefined ? { rules: input.rules } : {}),
        ...(input.logic !== undefined ? { logic: input.logic } : {}),
        ...(input.isDynamic !== undefined ? { isDynamic: input.isDynamic } : {}),
        ...(input.contactIds !== undefined ? { contactIds: unique(input.contactIds) } : {}),
      })
      .where(and(eq(contactGroups.id, id), eq(contactGroups.orgId, orgId)))
      .returning();
    return row ? toGroup(row) : null;
  }

  async getById(id: string, orgId: OrgId): Promise<ContactGroupRecord | null> {
    const [row] = await this.db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.orgId, orgId)))
      .limit(1);
    return row ? toGroup(row) : null;
  }

  async list(orgId: OrgId, limit = 50): Promise<ContactGroupRecord[]> {
    const rows = await this.db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.orgId, orgId))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(toGroup);
  }

  async countContacts(id: string, orgId: OrgId): Promise<number> {
    const group = await this.getById(id, orgId);
    if (!group) return 0;

    let count = 0;
    for await (const _id of this.memberIds(group)) count += 1;
    return count;
  }

  async sampleContacts(id: string, orgId: OrgId, limit = 10) {
    const ids = await this.resolveContactIds(id, orgId, limit);
    return new PostgresContactRepo(this.db).listByIds(ids, orgId);
  }

  // One past the limit, so a caller can tell an audience is too big instead of cutting it short.
  async resolveContactIds(
    id: string,
    orgId: OrgId,
    limit = GROUP_AUDIENCE_LIMIT + 1
  ): Promise<string[]> {
    const group = await this.getById(id, orgId);
    if (!group) return [];

    const ids: string[] = [];
    for await (const contactId of this.memberIds(group)) {
      ids.push(contactId);
      if (ids.length >= limit) break;
    }
    return ids;
  }

  private async *memberIds(group: ContactGroupRecord): AsyncGenerator<string> {
    const contacts = new PostgresContactRepo(this.db);
    if (!group.isDynamic) {
      const members = await contacts.listByIds(group.contactIds ?? [], group.orgId);
      yield* members.map((contact) => contact.id);
      return;
    }

    // A group saved before validation must reach nobody rather than everybody.
    if (validateGroupDefinition(group).length > 0) return;
    const definition = { logic: group.logic, rules: group.rules as GroupRule[] };

    let afterId: string | undefined;
    for (;;) {
      const page = await contacts.listAfter(group.orgId, afterId, SCAN_PAGE_SIZE);
      yield* matchContactGroup(page, definition).map((contact) => contact.id);
      if (page.length < SCAN_PAGE_SIZE) return;
      afterId = page.at(-1)?.id;
    }
  }
}

function validateGroupInput(input: Pick<ContactGroupRecord, "isDynamic" | "rules" | "logic">) {
  const errors = validateGroupDefinition(input);
  if (errors.length > 0) throw new GroupRulesError(errors);
}

function unique(ids: string[] | undefined) {
  return ids && Array.from(new Set(ids));
}

function toGroup(row: typeof contactGroups.$inferSelect): ContactGroupRecord {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    rules: row.rules,
    logic: row.logic,
    isDynamic: row.isDynamic,
    contactIds: Array.isArray(row.contactIds) ? row.contactIds.map(String) : undefined,
  };
}
