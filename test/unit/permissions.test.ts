/**
 * The permission model: one key per module, plus the wildcard.
 *
 * B-051, B-052: the predecessor's keys were spread over navigation, guards and
 * the seed, and a module could end up with a key that no role ever granted.
 */
import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSIONS,
  MODULE_LABELS,
  MODULE_PERMISSIONS,
  WILDCARD_PERMISSION,
  hasAnyPermission,
  hasModule,
  hasPermission,
  moduleOf,
} from '#shared/permissions'
import type { ModuleKey } from '#shared/permissions'

describe('das Berechtigungsmodell', () => {
  it('hat für jedes Modul eine deutsche Bezeichnung', () => {
    for (const key of Object.keys(MODULE_PERMISSIONS)) {
      expect(MODULE_LABELS[key as keyof typeof MODULE_LABELS], key).toBeTruthy()
    }
  })

  it('nennt jeden Schlüssel nur einmal', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })

  it('M-04: kennt genau einen Schlüssel je Modul und keine Unterrechte', () => {
    // Keine Trennung nach Lesen und Schreiben, und seit dem Wegfall der
    // Zeiterfassung (M-10) auch keine Ausnahme mehr. Ein Doppelpunkt im
    // Schlüssel wäre ein Unterrecht — und damit der Anfang einer
    // Rechteverwaltung, die niemand pflegt.
    expect(ALL_PERMISSIONS.filter(key => key.includes(':'))).toEqual([])

    for (const [module, keys] of Object.entries(MODULE_PERMISSIONS)) {
      expect(keys, module).toHaveLength(1)
      expect(keys[0], module).toBe(module)
    }
  })
})

describe('hasPermission', () => {
  it('erkennt die genaue Berechtigung', () => {
    expect(hasPermission(new Set(['customers']), 'customers')).toBe(true)
  })

  it('erkennt eine fehlende Berechtigung', () => {
    expect(hasPermission(new Set(['customers']), 'settings')).toBe(false)
  })

  it('lässt den Platzhalter alles', () => {
    expect(hasPermission(new Set([WILDCARD_PERMISSION]), 'settings')).toBe(true)
  })

  it('ist für einen Benutzer ohne Rechte überall falsch', () => {
    for (const key of ALL_PERMISSIONS) {
      expect(hasPermission(new Set(), key), key).toBe(false)
    }
  })
})

describe('hasAnyPermission', () => {
  it('genügt eine von mehreren', () => {
    expect(hasAnyPermission(new Set(['orders']), 'employees', 'orders')).toBe(true)
  })

  it('ist falsch, wenn keine passt', () => {
    expect(hasAnyPermission(new Set(['customers']), 'employees', 'orders')).toBe(false)
  })

  it('ist ohne Angabe falsch', () => {
    expect(hasAnyPermission(new Set(['customers']))).toBe(false)
  })

  it('lässt den Platzhalter auch hier durch', () => {
    expect(hasAnyPermission(new Set([WILDCARD_PERMISSION]), 'settings')).toBe(true)
  })
})

describe('moduleOf', () => {
  it.each([
    ['customers', 'customers'],
    ['tires', 'tires'],
    ['settings', 'settings'],
  ])('ordnet %s dem Modul %s zu', (key, module) => {
    expect(moduleOf(key)).toBe(module)
  })

  it('kennt einen erfundenen Schlüssel nicht', () => {
    expect(moduleOf('gibtsnicht')).toBeUndefined()
  })
})

describe('hasModule', () => {
  it('genügt der Schlüssel des Moduls', () => {
    expect(hasModule(new Set(['employees']), 'employees')).toBe(true)
  })

  it('ist ohne ihn falsch', () => {
    expect(hasModule(new Set(['customers']), 'employees')).toBe(false)
  })

  it('lässt sich von einem ähnlichen Schlüssel nicht täuschen', () => {
    // Kein Präfix-Vergleich: `customers` ist nicht `customer_inquiries`.
    expect(hasModule(new Set(['customers']), 'calendar')).toBe(false)
    expect(hasPermission(new Set(['customers']), 'customers:write')).toBe(false)
  })

  it('lässt den Platzhalter überall', () => {
    for (const module of Object.keys(MODULE_PERMISSIONS)) {
      expect(hasModule(new Set([WILDCARD_PERMISSION]), module as never), module).toBe(true)
    }
  })
})

describe('Regression', () => {
  it('B-058: wer ein Modul erreichen darf, sieht seinen Eintrag auch', () => {
    // Der Vorgänger verlangte im Sidebar-Eintrag genau `hours:write_own`. Eine
    // Rolle mit vollem `hours`-Zugriff verlor den Eintrag — die geseedeten
    // Rollen hielten zufällig beide Schlüssel, deshalb fiel es nicht auf.
    //
    // Das Modul gibt es nicht mehr (M-10), und mit einem Schlüssel je Modul
    // kann der Fehler nicht wiederkehren. Genau das wird hier festgehalten:
    // für **jedes** Modul beantworten beide Fragen dasselbe.
    for (const module of Object.keys(MODULE_PERMISSIONS) as ModuleKey[]) {
      const holder = new Set([module])
      expect(hasModule(holder, module), module).toBe(true)
      expect(hasPermission(holder, module), module).toBe(true)
    }
  })
})
