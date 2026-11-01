import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("organizations_slug_uq").on(table.slug)]
);

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("members_organization_id_idx").on(table.organizationId),
    index("members_user_id_idx").on(table.userId),
    uniqueIndex("members_org_user_uq").on(table.organizationId, table.userId),
  ]
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    inviterId: text("inviter_id").notNull(),
  },
  (table) => [
    index("invitations_organization_id_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
  ]
);

export const organizationRoles = pgTable(
  "organization_roles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    role: text("role").notNull(),
    permission: text("permission").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("organization_roles_org_idx").on(table.organizationId),
    uniqueIndex("organization_roles_org_role_uq").on(table.organizationId, table.role),
  ]
);
