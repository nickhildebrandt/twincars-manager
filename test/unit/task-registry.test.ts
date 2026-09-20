/**
 * The registry of recurring work.
 *
 * The predecessor had no scheduler: reminders ran only when somebody pressed
 * a button. With a live schedule (E-12) two things matter — the schedule and
 * the implementation must come from the same declaration, and a job must be
 * safe to start twice.
 */
import { describe, expect, it } from 'vitest'
import {
  TASKS,
  WEEKDAY_MORNING,
  isTaskName,
  scheduledTasksConfig,
  taskByName,
} from '../../server/tasks/_registry.ts'
import type { TaskDeclaration } from '../../server/tasks/_registry.ts'

const fixture: TaskDeclaration[] = [
  { name: 'reminders:due', label: 'Zahlungserinnerungen', cron: WEEKDAY_MORNING, permission: 'reminders' },
  { name: 'tires:due', label: 'Reifen-Erinnerungen', cron: WEEKDAY_MORNING, permission: 'tires' },
  { name: 'ebay:sync', label: 'eBay-Abgleich', cron: '0 * * * *', permission: 'settings' },
]

describe('WEEKDAY_MORNING', () => {
  it('steht auf werktags 7:30 Uhr', () => {
    // E-12: vor Werkstattöffnung, nach der Nacht, kein Wochenende.
    expect(WEEKDAY_MORNING).toBe('30 7 * * 1-5')
  })
})

describe('scheduledTasksConfig', () => {
  it('fasst Aufgaben mit gleichem Zeitplan zusammen', () => {
    expect(scheduledTasksConfig(fixture)).toEqual({
      '30 7 * * 1-5': ['reminders:due', 'tires:due'],
      '0 * * * *': ['ebay:sync'],
    })
  })

  it('ergibt ohne Aufgaben eine leere Zuordnung', () => {
    expect(scheduledTasksConfig([])).toEqual({})
  })
})

describe('isTaskName und taskByName', () => {
  it('kennt jede angemeldete Aufgabe', () => {
    for (const task of TASKS) {
      expect(isTaskName(task.name), task.name).toBe(true)
      expect(taskByName(task.name)?.label).toBe(task.label)
    }
  })

  it('lehnt einen erfundenen Namen ab', () => {
    // Der Knopf „Jetzt prüfen" reicht einen Namen aus dem Netz weiter; ohne
    // diese Prüfung stünde er ungefiltert in `runTask`.
    expect(isTaskName('alles:loeschen')).toBe(false)
    expect(taskByName('alles:loeschen')).toBeUndefined()
  })
})

describe('die angemeldeten Aufgaben', () => {
  it('haben eindeutige Namen', () => {
    const names = TASKS.map(task => task.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('heißen wie ihre Datei', () => {
    for (const task of TASKS) {
      expect(task.name, task.label).toMatch(/^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$/)
    }
  })
})
