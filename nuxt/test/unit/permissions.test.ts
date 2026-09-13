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

describe('das Berechtigungsmodell', () => {
  it('hat für jedes Modul eine deutsche Bezeichnung', () => {
    for (const key of Object.keys(MODULE_PERMISSIONS)) {
      expect(MODULE_LABELS[key as keyof typeof MODULE_LABELS], key).toBeTruthy()
    }
  })

  it('nennt jeden Schlüssel nur einmal', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length)
  })

  it('kennt keine Trennung nach Lesen und Schreiben', () => {
    // Eine Berechtigung je Modul. Die einzige Ausnahme ist die Selbstauskunft
    // bei den Stunden.
    const split = ALL_PERMISSIONS.filter(
      key => key.includes(':') && key !== 'hours:write_own',
    )
    expect(split).toEqual([])
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
    ['hours', 'hours'],
    ['hours:write_own', 'hours'],
    ['settings', 'settings'],
  ])('ordnet %s dem Modul %s zu', (key, module) => {
    expect(moduleOf(key)).toBe(module)
  })

  it('kennt einen erfundenen Schlüssel nicht', () => {
    expect(moduleOf('gibtsnicht')).toBeUndefined()
  })
})

describe('hasModule', () => {
  it('genügt der Vollzugriff', () => {
    expect(hasModule(new Set(['hours']), 'hours')).toBe(true)
  })

  it('genügt auch die Selbstauskunft', () => {
    expect(hasModule(new Set(['hours:write_own']), 'hours')).toBe(true)
  })

  it('ist ohne beides falsch', () => {
    expect(hasModule(new Set(['customers']), 'hours')).toBe(false)
  })

  it('lässt den Platzhalter überall', () => {
    for (const module of Object.keys(MODULE_PERMISSIONS)) {
      expect(hasModule(new Set([WILDCARD_PERMISSION]), module as never), module).toBe(true)
    }
  })
})

describe('Regression', () => {
  it('B-058: wer vollen Zugriff hat, sieht den Eintrag auch', () => {
    // Der Vorgänger verlangte im Sidebar-Eintrag genau `hours:write_own`. Eine
    // Rolle mit vollem `hours`-Zugriff verlor den Eintrag — die geseedeten
    // Rollen hielten zufällig beide Schlüssel, deshalb fiel es nicht auf.
    const fullAccess = new Set(['hours'])
    expect(hasModule(fullAccess, 'hours')).toBe(true)

    // Und die Umkehrung stimmt weiterhin: Sehen heißt nicht alles dürfen.
    const selfServiceOnly = new Set(['hours:write_own'])
    expect(hasModule(selfServiceOnly, 'hours')).toBe(true)
    expect(hasPermission(selfServiceOnly, 'hours')).toBe(false)
  })
})
