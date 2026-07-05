/**
 * Repository layer for the singleton SMTP settings row. Shared by the
 * setup wizard (`setup.remote.ts`) and the settings page
 * (`settings.remote.ts`) so the encrypt-and-upsert semantics stay
 * identical in both flows.
 */
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db/client'
import { smtpSettings } from '$lib/server/db/schema'
import { encryptSecret } from '$lib/server/crypto'

/**
 * Input for {@link upsertSmtpSettings}. The password arrives in
 * plaintext and is encrypted (AES-256-GCM via `$lib/server/crypto`)
 * before it touches the database.
 */
export interface SmtpSettingsInput {
  host: string
  port: number
  secure: 'none' | 'STARTTLS' | 'TLS'
  username: string
  /**
   * Plaintext password. An empty string keeps the stored (already
   * encrypted) password on update; the insert path stores `''`.
   */
  password: string
  fromAddress: string
  fromName: string
  replyTo: string | null
}

/**
 * Create or update the singleton SMTP settings row. The password is
 * encrypted at rest (`mail-service` decrypts on use), `verified` is
 * reset to `false` and `updatedAt` is bumped on every save.
 */
export async function upsertSmtpSettings(
  input: SmtpSettingsInput
): Promise<void> {
  const rows = await db.select().from(smtpSettings).limit(1)
  const id = rows[0]?.id
  if (!id) {
    await db.insert(smtpSettings).values({
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username,
      // Encrypted at rest; mail-service decrypts when sending.
      password: input.password ? encryptSecret(input.password) : '',
      fromAddress: input.fromAddress,
      fromName: input.fromName,
      replyTo: input.replyTo,
      verified: false,
      updatedAt: new Date()
    })
  } else {
    await db
      .update(smtpSettings)
      .set({
        host: input.host,
        port: input.port,
        secure: input.secure,
        username: input.username,
        // Empty input keeps the stored (already encrypted) password.
        password: input.password
          ? encryptSecret(input.password)
          : rows[0].password,
        fromAddress: input.fromAddress,
        fromName: input.fromName,
        replyTo: input.replyTo,
        verified: false,
        updatedAt: new Date()
      })
      .where(eq(smtpSettings.id, id))
  }
}
