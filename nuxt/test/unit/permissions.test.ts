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
  hasPermission,
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
