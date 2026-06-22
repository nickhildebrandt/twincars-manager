import { command, query, requested } from '$app/server'
import {
  boolean,
  check,
  maxValue,
  minValue,
  number,
  object,
  pipe,
  string,
  trim
} from 'valibot'
import {
  listWorkshopHours,
  updateWorkshopHours
} from '$lib/server/services/workshop-hours-service'
import { requirePermission } from '$lib/server/auth-guards'

/** `HH:MM` (24-hour clock) — what an `<input type="time">` produces. */
const timeStringSchema = pipe(
  string('Bitte eine Uhrzeit eingeben.'),
  trim(),
  check(
    (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v),
    'Bitte eine gültige Uhrzeit im Format HH:MM eingeben.'
  )
)

const weekdaySchema = pipe(
  number('Bitte einen Wochentag wählen.'),
  minValue(0, 'Wochentag muss zwischen 0 und 6 liegen.'),
  maxValue(6, 'Wochentag muss zwischen 0 und 6 liegen.'),
  check((v) => Number.isInteger(v), 'Wochentag muss ganzzahlig sein.')
)

const updateInputSchema = object({
  weekday: weekdaySchema,
  opensAt: timeStringSchema,
  closesAt: timeStringSchema,
  closed: boolean()
})

/**
 * Return all 7 weekday rows. Lazily creates missing rows so the
 * page always renders a complete week.
 *
 * @group integration
 * @module workshop-hours
 */
export const listWorkshopHoursRemote = query(async () => {
  requirePermission('settings')
  return listWorkshopHours()
})

/**
 * Update one weekday's opening hours.
 *
 * @group integration
 * @module workshop-hours
 */
export const updateWorkshopHoursRemote = command(
  updateInputSchema,
  async ({ weekday, opensAt, closesAt, closed }) => {
    requirePermission('settings')
    const updated = await updateWorkshopHours(weekday, {
      opensAt,
      closesAt,
      closed
    })
    await requested(listWorkshopHoursRemote, 4).refreshAll()
    return updated
  }
)
