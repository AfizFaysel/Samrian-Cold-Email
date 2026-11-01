import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionRoute } from "@/server/api/session-route";
import { sessionOperations } from "@/server/auth/policy";
import { isUsableFooter } from "@/server/modules/compliance";
import { PostgresSettingsRepo } from "@/server/repos";

const text = z
  .string()
  .trim()
  .max(2000)
  .transform((value) => value || null)
  .nullable();
const rate = z.number().min(0).max(1);

const complianceUpdateSchema = z
  .object({
    listUnsubscribeEnabled: z.boolean(),
    clickTrackingEnabled: z.boolean(),
    openTrackingEnabled: z.boolean(),
    physicalAddress: text,
    defaultSenderName: text,
    unsubscribeFooter: text.refine(isUsableFooter, "Footer must include {{unsubscribeUrl}}"),
    unsubscribeMailto: text,
    bouncePauseRate: rate,
    unsubscribePauseRate: rate,
    complaintPauseRate: rate,
  })
  .strict()
  .partial();

export const GET = createSessionRoute(
  sessionOperations.complianceRead,
  async ({ db, orgId }, _request?: Request) => {
    const repo = new PostgresSettingsRepo(db);
    return NextResponse.json(await repo.getCompliance(orgId));
  }
);

export const PATCH = createSessionRoute(
  sessionOperations.complianceUpdate,
  async ({ db, orgId }, request: Request) => {
    const parsed = complianceUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const repo = new PostgresSettingsRepo(db);
    await repo.upsertCompliance(orgId, parsed.data);
    return NextResponse.json(await repo.getCompliance(orgId));
  }
);
