/**
 * Recurring work: one declaration per job.
 *
 * The predecessor had no scheduler at all — payment reminders and tire
 * reminders only ran when somebody pressed "Jetzt prüfen". Nitro brings
 * scheduling with it, so the schedule is on: weekdays at 07:30 Europe/Berlin
 * (../../docs/rewrite/08-entscheidungen.md E-12). The button stays, and it
 * triggers the **same** task through `runTask` — one implementation, two ways
 * to start it.
 *
 * Every task must be safe to run twice. With a live schedule that is not a
 * nicety: a retry, a restart at the wrong moment, or an operator pressing the
 * button after the schedule already ran must not send anything twice.
 */

export type TaskDeclaration = {
  /** Nitro task name, matching the file `server/tasks/<name>.ts`. */
  name: string
  /** German label for the button and the log. */
  label: string
  /** Cron expression, read in the business time zone. */
  cron: string
  /** Module permission a person needs to trigger it by hand. */
  permission: string
}

/** Weekdays at 07:30 — before the workshop opens, after the night is over. */
export const WEEKDAY_MORNING = '30 7 * * 1-5'

/** Nachts um kurz nach drei — da ist niemand im Haus. */
export const NIGHTLY = '10 3 * * *'

/**
 * The jobs. Filled by the packages that own the work:
 * payment reminders and tire reminders arrive with T-025.
 */
export const TASKS: readonly TaskDeclaration[] = [
  {
    name: 'protokoll-rotieren',
    label: 'Protokoll aufräumen',
    cron: NIGHTLY,
    permission: 'settings',
  },
]

/** Whether a name belongs to a declared task — guards the manual trigger. */
export function isTaskName(name: string): boolean {
  return TASKS.some(task => task.name === name)
}

/** One declaration by name. */
export function taskByName(name: string): TaskDeclaration | undefined {
  return TASKS.find(task => task.name === name)
}

/**
 * The `scheduledTasks` map Nitro expects: cron expression → task names.
 *
 * Several jobs on the same expression share one entry, which is why this is
 * built rather than written by hand.
 */
export function scheduledTasksConfig(
  tasks: readonly TaskDeclaration[] = TASKS,
): Record<string, string[]> {
  const byCron: Record<string, string[]> = {}
  for (const task of tasks) {
    ;(byCron[task.cron] ??= []).push(task.name)
  }
  return byCron
}
