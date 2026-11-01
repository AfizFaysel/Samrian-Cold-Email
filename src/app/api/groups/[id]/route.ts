import { groupUpdateSchema } from "@samrian/contracts";
import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { GroupRulesError } from "@/server/modules/groups";
import { PostgresGroupRepo } from "@/server/repos";

export const GET = createSessionRoute(
  sessionOperations.groupRead,
  async ({ orgId, db }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const repo = new PostgresGroupRepo(db);
    const group = await repo.getById(id, orgId);
    const count = await repo.countContacts(id, orgId);
    return NextResponse.json({ group, count });
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.groupUpdate,
  async ({ orgId, db }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const parsed = groupUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid group" }, { status: 400 });
    }

    try {
      const group = await new PostgresGroupRepo(db).update(id, orgId, parsed.data);
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      return NextResponse.json({ group });
    } catch (error) {
      if (error instanceof GroupRulesError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }
);
