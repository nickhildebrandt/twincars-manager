-- Migration 0021: drop the AES-GCM SMTP-password encryption.
--
-- The application no longer encrypts the SMTP password at rest. The
-- column is renamed in place — any existing ciphertext stays as-is
-- (operators can clear it via the settings UI; the next save writes
-- plaintext). The previous `APP_ENCRYPTION_KEY` env var is removed
-- from the codebase entirely.

ALTER TABLE "smtp_settings" RENAME COLUMN "password_encrypted" TO "password";
