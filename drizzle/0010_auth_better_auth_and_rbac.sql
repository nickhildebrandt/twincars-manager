-- Migration 0010: better-auth core tables + RBAC overlay.
--
-- We use better-auth (email + password) for the actual session,
-- password hashing, CSRF, and cookie handling, but disable
-- email-based signup / verification flows in the auth config — the
-- admin creates accounts manually from the settings UI. The username
-- plugin's `username` column on `users` is the actual login handle;
-- `email` is synthesized from the username because better-auth still
-- treats it as the canonical identifier.
--
-- On top of better-auth, we layer our own RBAC tables (`roles`,
-- `user_roles`, `role_permissions`). Permissions are simple string
-- keys ("customers:read", "settings:write", ...). The magic key `*`
-- on a role grants every permission and is seeded into the
-- "Administrator" role.

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "username" text,
  "display_username" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "sessions" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "accounts" ("user_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "verifications" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications" ("identifier");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_idx" ON "roles" ("name");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" text NOT NULL,
  "role_id" uuid NOT NULL,
  CONSTRAINT "user_roles_pk" PRIMARY KEY ("user_id", "role_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk"
    FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission" varchar(100) NOT NULL,
  CONSTRAINT "role_permissions_pk" PRIMARY KEY ("role_id", "permission")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk"
    FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
