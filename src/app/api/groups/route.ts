import { groupWriteSchema } from "@samrian/contracts";
import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { GroupRulesError } from "@/server/modules/groups";
import { PostgresGroupRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.groupList, async ({ orgId, db }) => {
  const groups = await new PostgresGroupRepo(db).list(orgId);
  return NextResponse.json({ groups });
});

export const POST = createSessionRoute(
  sessionOperations.groupCreate,
  async ({ orgId, userId, db }, request: Request) => {
    const parsed = groupWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid group" }, { status: 400 });
    }

    try {
      const group = await new PostgresGroupRepo(db).create({
        ...parsed.data,
        orgId,
        createdBy: userId,
      });
      return NextResponse.json({ group }, { status: 201 });
    } catch (error) {
      if (error instanceof GroupRulesError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }
);
