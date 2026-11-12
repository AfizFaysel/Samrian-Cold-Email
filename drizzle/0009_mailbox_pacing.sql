ALTER TABLE "mailboxes" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "next_send_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "hour_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD COLUMN "hour_sends" integer DEFAULT 0 NOT NULL;