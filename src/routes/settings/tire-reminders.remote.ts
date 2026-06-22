import { command, query } from '$app/server'
import { object, picklist } from 'valibot'
import { requirePermission } from '$lib/server/auth-guards'
import {
  previewTireReminderCandidates,
  sendTireReminders
} from '$lib/server/services/tire-reminder-service'

/**
 * Schema for both preview + send: only the season is required, the
 * year is always derived server-side from the current date so the
 * caller cannot back-date a send.
 */
const seasonSchema = object({ season: picklist(['spring', 'autumn']) })

/**
 * Quick preview for the settings card: how many customers would be
 * mailed for the given season and a small sample of names so the
 * operator can sanity-check the list before triggering an actual send.
 *
 * @group integration
 * @module settings
 */
export const getTireReminderPreviewRemote = query(
  seasonSchema,
  async ({ season }) => {
    requirePermission('settings')
    return previewTireReminderCandidates(season)
  }
)

/**
 * Trigger the season-change tire-reminder send. Idempotent within the
 * current calendar year — customers already notified for the same
 * season/year are skipped.
 *
 * @group integration
 * @module settings
 */
export const sendTireRemindersRemote = command(
  seasonSchema,
  async ({ season }) => {
    requirePermission('settings')
    const result = await sendTireReminders(season)
    await getTireReminderPreviewRemote({ season }).refresh()
    return result
  }
)
