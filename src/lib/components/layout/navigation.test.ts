import { describe, it, expect } from 'vitest'
import {
  filterNavigationByPermissions,
  navigation,
  type NavGroup
} from './navigation'

/**
 * Unit tests for the navigation permission filter.
 *
 * @group unit
 * @module navigation
 */
describe('filterNavigationByPermissions', () => {
  const sample: NavGroup[] = [
    {
      label: 'A',
      items: [
        { label: 'No perm', href: '/a', icon: null as never },
        { label: 'Read', href: '/b', icon: null as never, permission: 'x' },
        { label: 'Write', href: '/c', icon: null as never, permission: 'y' }
      ]
    },
    {
      label: 'B',
      items: [
        {
          label: 'Admin',
          href: '/d',
          icon: null as never,
          permission: 'admin:only'
        }
      ]
    }
  ]

  it('keeps items without a permission requirement', () => {
    const out = filterNavigationByPermissions(sample, new Set())
    expect(out).toHaveLength(1)
    expect(out[0].items.map((i) => i.label)).toEqual(['No perm'])
  })

  it('keeps only items whose permission is granted', () => {
    const out = filterNavigationByPermissions(sample, new Set(['x']))
    expect(out).toHaveLength(1)
    expect(out[0].items.map((i) => i.label)).toEqual(['No perm', 'Read'])
  })

  it('drops empty groups after filtering', () => {
    const out = filterNavigationByPermissions(
      [
        {
          label: 'Only',
          items: [
            {
              label: 'gated',
              href: '/g',
              icon: null as never,
              permission: 'nope'
            }
          ]
        }
      ],
      new Set()
    )
    expect(out).toEqual([])
  })

  it('short-circuits to the full list with the wildcard permission', () => {
    const out = filterNavigationByPermissions(sample, new Set(['*']))
    expect(out).toEqual(sample)
  })

  it('does not mutate the input', () => {
    const before = JSON.stringify(sample)
    filterNavigationByPermissions(sample, new Set(['x']))
    expect(JSON.stringify(sample)).toBe(before)
  })

  describe('against the real navigation', () => {
    it('shows nothing module-gated for an anonymous-equivalent set', () => {
      const out = filterNavigationByPermissions(navigation, new Set())
      // Only the items without `permission` should remain. Today that's
      // the "Start" item alone (every other entry is permission-gated).
      const labels = out.flatMap((g) => g.items.map((i) => i.label))
      expect(labels).toEqual(['Start'])
    })

    it('full admin sees every group', () => {
      const out = filterNavigationByPermissions(navigation, new Set(['*']))
      expect(out.length).toBe(navigation.length)
    })

    it('a customer-read-only employee sees Kunden but not Fahrzeuge', () => {
      const out = filterNavigationByPermissions(
        navigation,
        new Set(['customers'])
      )
      const labels = out.flatMap((g) => g.items.map((i) => i.label))
      expect(labels).toContain('Kunden')
      expect(labels).not.toContain('Fahrzeuge')
    })

    it('labels the reminders module "Offene Rechnungen" (requirement 2.11)', () => {
      const item = navigation
        .flatMap((g) => g.items)
        .find((i) => i.href === '/reminders')
      expect(item?.label).toBe('Offene Rechnungen')
    })

    it('keeps the System group to Einstellungen only (requirement 2.12)', () => {
      const system = navigation.find((g) => g.label === 'System')
      expect(system?.items.map((i) => i.label)).toEqual(['Einstellungen'])
      // No sidebar Import entry — the import lives as a /settings tab.
      const hrefs = navigation.flatMap((g) => g.items.map((i) => i.href))
      expect(hrefs).not.toContain('/settings/import')
    })

    it('lists Anfragen under Kommunikation with the mailings permission', () => {
      const komm = navigation.find((g) => g.label === 'Kommunikation')
      const anfragen = komm?.items.find((i) => i.label === 'Anfragen')
      expect(anfragen?.href).toBe('/settings/inquiries')
      expect(anfragen?.permission).toBe('mailings')
      const system = navigation.find((g) => g.label === 'System')
      expect(system?.items.map((i) => i.label)).not.toContain('Anfragen')
    })
  })
})
