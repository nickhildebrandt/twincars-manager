-- eBay OAuth connection of the workshop's seller account. Single-row
-- semantics enforced in the service layer. access_token/refresh_token
-- are stored AES-256-GCM-encrypted (v1:iv:tag:data), never plaintext.
CREATE TABLE IF NOT EXISTS "ebay_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ebay_username" varchar(100),
	"access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token" text NOT NULL,
	"refresh_token_expires_at" timestamp with time zone,
	"scopes" text DEFAULT '' NOT NULL,
	"environment" varchar(20) DEFAULT 'production' NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
