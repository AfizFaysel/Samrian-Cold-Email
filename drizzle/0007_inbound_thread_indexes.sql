DELETE FROM "threads" AS newer
USING "threads" AS older
WHERE newer."direction" = 'received'
  AND older."direction" = 'received'
  AND newer."org_id" = older."org_id"
  AND newer."message_id" = older."message_id"
  AND (newer."created_at", newer."id") > (older."created_at", older."id");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_org_received_message_idx" ON "threads" USING btree ("org_id","message_id") WHERE "threads"."direction" = 'received';--> statement-breakpoint
CREATE INDEX "threads_sent_lookup_idx" ON "threads" USING btree ("org_id","mailbox_id",lower(btrim("message_id", '<> '))) WHERE "threads"."direction" = 'sent';