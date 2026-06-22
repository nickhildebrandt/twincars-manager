-- Drop the DB-backed API token table. Public-REST authentication is
-- now driven by the `API_TOKENS` environment variable; the admin UI
-- and the underlying mint/list/revoke workflow have been removed.
DROP TABLE IF EXISTS api_tokens;
