-- User deactivation: accounts can be disabled without losing their data
-- or role assignments. Deactivated users are blocked at sign-in and on
-- every authenticated request. Existing rows default to active.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
