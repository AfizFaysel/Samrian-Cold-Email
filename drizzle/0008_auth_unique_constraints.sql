DROP INDEX "accounts_account_provider_idx";--> statement-breakpoint
DROP INDEX "sessions_token_idx";--> statement-breakpoint
DROP INDEX "members_org_user_idx";--> statement-breakpoint
DROP INDEX "organizations_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_account_provider_uq" ON "accounts" USING btree ("account_id","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_uq" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "members_org_user_uq" ON "members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uq" ON "organizations" USING btree ("slug");