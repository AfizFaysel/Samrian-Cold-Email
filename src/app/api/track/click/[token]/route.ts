import { NextResponse } from "next/server";

import { getDb } from "@/server/db/db";
import { withTenant, withTrackingToken } from "@/server/db/tenant";
import { recordEvent } from "@/server/modules/events";
import { errorReporter } from "@/server/observability/runtime";
import { clickEvent } from "@/server/modules/tracking";
import { PostgresEventRepo } from "@/server/repos";
import { withTrackingLimit } from "@/server/limits/http";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return withTrackingLimit(request, "tracking.click", (record) => track(context, record));
}

async function track({ params }: { params: Promise<{ token: string }> }, record: boolean) {
  const { token } = await params;
  const db = getDb();
  const link = await withTrackingToken(db, token, (tx) =>
    new PostgresEventRepo(tx).getTrackedLink(token)
  );

  if (!link) return new NextResponse("Tracking link not found", { status: 404 });
  if (!record) return NextResponse.redirect(link.originalUrl);

  try {
    await withTenant(db, { orgId: link.orgId, actorType: "request" }, (tx) =>
      recordEvent(
        clickEvent({
          orgId: link.orgId,
          campaignId: link.campaignId ?? undefined,
          contactId: link.contactId ?? undefined,
          assignmentId: link.assignmentId ?? undefined,
          threadId: link.threadId ?? undefined,
          messageId: link.messageId ?? undefined,
          token,
          occurredAt: Date.now(),
        }),
        { events: new PostgresEventRepo(tx) }
      )
    );
  } catch (error) {
    errorReporter.capture(error, { route: "/api/track/click/[token]", action: "track.click" });
  }

  return NextResponse.redirect(link.originalUrl);
}
