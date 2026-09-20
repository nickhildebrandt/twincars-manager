/**
 * Die Navigation: Reihenfolge, Sichtbarkeit, aktive Markierung.
 *
 * B-058: der Eintrag „Stunden" verlangte genau `hours:write_own`, sodass eine
 * Rolle mit vollem Zugriff ihn verlor. B-375: „Gesendet" stand nur unter
 * `invoices`, obwohl die Historie auch Rundschreiben zeigt. B-043: auf
 * `/settings/inquiries` waren zwei Einträge gleichzeitig markiert.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  NAVIGATION,
  activeItem,
  titleFor,
  visibleNavigation,
} from '#shared/navigation'
import { MODULE_PERMISSIONS, hasModule } from '#shared/permissions'
import type { ModuleKey } from '#shared/permissions'

const allItems = NAVIGATION.flatMap(group => group.items)

/** Sichtbarkeit, wie die Oberfläche sie vom Server bekommt. */
const canWith = (...permissions: string[]) => {
  const held = new Set(permissions)
  return (module: ModuleKey) => hasModule(held, module)
}

describe('Der Aufbau', () => {
  it('hat acht Gruppen in der Reihenfolge des Bestands', () => {
    expect(NAVIGATION.map(group => group.label)).toEqual([
      'Übersicht',
      'Kunden & Fahrzeuge',
      'Aufträge & Rechnungen',
      'Stammdaten',
      'Personal',
      'Finanzen',
      'Kommunikation',
      'System',
    ])
  })

  it('nennt jeden Pfad nur einmal', () => {
    const paths = allItems.map(item => item.to)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it.each(allItems.map(item => [item.label, item] as const))(
    '%s zeigt auf ein Modul, das es gibt',
    (_label, item) => {
      for (const module of item.modules ?? []) {
        expect(MODULE_PERMISSIONS, module).toHaveProperty(module)
      }
    },
  )

  it.each(allItems.map(item => [item.label, item.icon] as const))(
    '%s benutzt ein Symbol, das die Sammlung kennt (%s)',
    (_label, icon) => {
      // Ein fehlendes Symbol fällt sonst erst im Browser auf — als Lücke.
      const set = JSON.parse(readFileSync(
        fileURLToPath(new URL('../../node_modules/@iconify-json/lucide/icons.json', import.meta.url)),
        'utf8',
      )) as { icons: Record<string, unknown>, aliases?: Record<string, unknown> }
      const name = icon.replace('i-lucide-', '')
      expect(name in set.icons || name in (set.aliases ?? {})).toBe(true)
    },
  )

  it('beginnt mit der Startseite, die jeder sieht', () => {
    const first = NAVIGATION[0]!.items[0]!
    expect(first.to).toBe('/')
    expect(first.modules).toBeUndefined()
    expect(first.exact).toBe(true)
  })
})

describe('visibleNavigation', () => {
  it('zeigt dem Administrator alles', () => {
    const visible = visibleNavigation(canWith('*'))
    expect(visible).toHaveLength(NAVIGATION.length)
    expect(visible.flatMap(group => group.items)).toHaveLength(allItems.length)
  })

  it('zeigt einem Benutzer ohne Modulrecht nur „Start"', () => {
    const visible = visibleNavigation(canWith())
    expect(visible).toHaveLength(1)
    expect(visible[0]!.items.map(item => item.label)).toEqual(['Start'])
  })

  it('lässt eine Gruppe verschwinden, wenn alle ihre Einträge fehlen', () => {
    const visible = visibleNavigation(canWith('customers'))
    expect(visible.map(group => group.label)).toEqual(['Übersicht', 'Kunden & Fahrzeuge'])
    expect(visible[1]!.items.map(item => item.label)).toEqual(['Kunden'])
  })

  it('behält die Reihenfolge der Gruppen', () => {
    const visible = visibleNavigation(canWith('settings', 'customers', 'ledger'))
    expect(visible.map(group => group.label)).toEqual([
      'Übersicht',
      'Kunden & Fahrzeuge',
      'Aufträge & Rechnungen',
      'Finanzen',
      'System',
    ])
  })
})

describe('activeItem', () => {
  it.each([
    ['/', 'Start'],
    ['/customers', 'Kunden'],
    ['/customers/9f1c', 'Kunden'],
    ['/customers/9f1c/edit', 'Kunden'],
    ['/invoices?page=2', 'Rechnungen'],
    ['/settings', 'Einstellungen'],
  ])('markiert für %s den Eintrag %s', (path, label) => {
    expect(activeItem(path)?.label).toBe(label)
  })

  it('markiert die Startseite nicht auf jeder Unterseite', () => {
    expect(activeItem('/customers')?.label).not.toBe('Start')
  })

  it('markiert nur einen Eintrag, auch bei geschachtelten Pfaden', () => {
    // B-043: „Einstellungen" und „Anfragen" waren gleichzeitig hervorgehoben.
    expect(activeItem('/settings/inquiries')?.label).toBe('Anfragen')
  })

  it('markiert nichts auf einer unbekannten Seite', () => {
    expect(activeItem('/gibtsnicht')).toBeUndefined()
  })

  it('lässt sich von einem abschließenden Schrägstrich nicht stören', () => {
    expect(activeItem('/customers/')?.label).toBe('Kunden')
  })

  it('verwechselt einen ähnlichen Pfad nicht', () => {
    expect(activeItem('/customers-archiv')).toBeUndefined()
  })
})

describe('titleFor', () => {
  it('nennt die Seite', () => {
    expect(titleFor('/customers/9f1c')).toBe('Kunden')
  })

  it('fällt auf den Anwendungsnamen zurück', () => {
    expect(titleFor('/gibtsnicht')).toBe('TwinCarsManager')
  })
})

describe('Regression', () => {
  it('B-058: wer ein Modul besitzt, behält dessen Eintrag', () => {
    // Der Eintrag „Stunden" verlangte genau `hours:write_own`, sodass eine
    // Rolle mit vollem Zugriff ihn verlor. Der Eintrag ist mit der
    // Zeiterfassung entfallen (M-10) — die Zusage gilt für alle anderen:
    // jeder Eintrag ist für jeden sichtbar, der eines seiner Module hat.
    for (const item of allItems) {
      for (const module of item.modules ?? []) {
        const labels = visibleNavigation(canWith(module))
          .flatMap(group => group.items)
          .map(entry => entry.label)
        expect(labels, `${item.label} über ${module}`).toContain(item.label)
      }
    }
  })

  it('M-10: führt keinen Eintrag für die Zeiterfassung mehr', () => {
    expect(allItems.map(item => item.to)).not.toContain('/hours')
    expect(allItems.flatMap(item => item.modules ?? [])).not.toContain('hours')
  })

  it('B-375: wer Rundschreiben verschickt, sieht die Versandhistorie', () => {
    const labels = (permission: string) =>
      visibleNavigation(canWith(permission)).flatMap(group => group.items).map(item => item.label)

    for (const permission of ['invoices', 'offers', 'reminders', 'mailings']) {
      expect(labels(permission), permission).toContain('Gesendet')
    }
    expect(labels('customers')).not.toContain('Gesendet')
  })

  it('B-043: kein Pfad markiert zwei Einträge', () => {
    const paths = allItems.map(item => item.to).concat(['/settings/inquiries', '/customers/9f1c'])
    for (const path of paths) {
      const matches = allItems.filter((item) => {
        const clean = path.replace(/\/+$/, '') || '/'
        return item.exact ? clean === item.to : clean === item.to || clean.startsWith(`${item.to}/`)
      })
      // Mehrere können passen — markiert wird aber genau einer, der längste.
      expect(activeItem(path), path).toBe(
        matches.reduce((best, item) => (item.to.length > (best?.to.length ?? -1) ? item : best),
          undefined as typeof matches[number] | undefined),
      )
    }
  })
})
