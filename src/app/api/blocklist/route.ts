import { blocklistAddSchema } from "@samrian/contracts";
import { NextResponse } from "next/server";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { PostgresBlocklistRepo } from "@/server/repos";

export const GET = createSessionRoute(sessionOperations.blocklistList, async ({ orgId, db }) => {
  const entries = await new PostgresBlocklistRepo(db).listEntries(orgId, 100);
  return NextResponse.json({ page: entries });
});

export const POST = createSessionRoute(
  sessionOperations.blocklistCreate,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const parsed = blocklistAddSchema.safeParse({
      ...body,
      email: typeof body?.email === "string" ? body.email.trim() : body?.email,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    await new PostgresBlocklistRepo(db).add({ ...parsed.data, orgId });
    return NextResponse.json({ success: true });
  }
);

export const DELETE = createSessionRoute(
  sessionOperations.blocklistDelete,
  async ({ orgId, db }, request: Request) => {
    const body = (await request.json()) as { email?: string };

    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const result = await new PostgresBlocklistRepo(db).remove(body.email, orgId);
    if (result === "opt-out") {
      return NextResponse.json(
        { error: "This address unsubscribed, so it cannot be removed" },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: result === "removed" });
  }
);
