-- Migration 0013: API tokens for the public token-authenticated API.
--
-- Tokens are minted from the admin "Benutzer & Rollen" / "API-Zugriff"
-- settings page and grant access to every public-API endpoint
-- (per user spec: a valid token = full access, no per-token scope
-- in v1). The actual token string is shown to the operator only once
-- at creation time; we store a SHA-256 hash so a compromised database
-- never exposes the live tokens.
--
-- `last_used_at` lets the admin spot stale tokens worth revoking.

CREATE TABLE IF NOT EXISTS "api_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(150) NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "token_prefix" varchar(16) NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_token_hash_idx" ON "api_tokens" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_revoked_idx" ON "api_tokens" ("revoked_at");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_user_id_fk"
    FOREIGN KEY ("created_by_user_id")
    REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
