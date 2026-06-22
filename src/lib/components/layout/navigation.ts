import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Car,
  Warehouse,
  CalendarClock,
  Clock,
  CircleDot,
  Disc3,
  FileText,
  Receipt,
  AlertTriangle,
  BookOpen,
  Package,
  Truck,
  Users2,
  Wallet,
  Calculator,
  Gift,
  Mail,
  Send,
  Settings,
  Database,
  Inbox
} from '@lucide/svelte'
import type { Component } from 'svelte'

export type NavItem = {
  label: string
  href: string
  icon: Component
  exact?: boolean
  /**
   * Required permission key to see this item in the sidebar. Filtered
   * by `filterNavigationByPermissions(navigation, permissions)`. Items
   * without a `permission` are visible to every signed-in user.
   */
  permission?: string
}

export type NavGroup = {
  label: string
  items: NavItem[]
  /** Any-of: at least one item in the group must be visible. */
  permission?: string
}

/**
 * Return a copy of `navigation` with items the user has no permission
 * to see removed. Groups that become empty are dropped. The `*`
 * wildcard short-circuits to the full list.
 */
export function filterNavigationByPermissions(
  groups: NavGroup[],
  permissions: Set<string>
): NavGroup[] {
  if (permissions.has('*')) return groups
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) => !it.permission || permissions.has(it.permission)
      )
    }))
    .filter((g) => g.items.length > 0)
}

/**
 * Sidebar navigation grouped by area. Used by the app shell.
 */
export const navigation: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { label: 'Start', href: '/', icon: LayoutDashboard, exact: true },
      {
        label: 'Kalender',
        href: '/calendar',
        icon: CalendarDays,
        permission: 'calendar'
      }
    ]
  },
  {
    label: 'Kunden & Fahrzeuge',
    items: [
      {
        label: 'Kunden',
        href: '/customers',
        icon: Users,
        permission: 'customers'
      },
      {
        label: 'Fahrzeuge',
        href: '/vehicles',
        icon: Car,
        permission: 'vehicles'
      },
      {
        label: 'Zu verkaufende Fahrzeuge',
        href: '/inventory',
        icon: Warehouse,
        permission: 'inventory'
      },
      {
        label: 'Reifenlager',
        href: '/tire-storage',
        icon: Disc3,
        permission: 'tires'
      }
    ]
  },
  {
    label: 'Aufträge & Rechnungen',
    items: [
      {
        label: 'Angebote / Kostenvoranschläge',
        href: '/offers',
        icon: FileText,
        permission: 'offers'
      },
      {
        label: 'Rechnungen',
        href: '/invoices',
        icon: Receipt,
        permission: 'invoices'
      },
      {
        label: 'Offene Rechnungen & Zahlungserinnerungen',
        href: '/reminders',
        icon: AlertTriangle,
        permission: 'reminders'
      },
      {
        label: 'Rechnungsausgangsbuch',
        href: '/sales-ledger',
        icon: BookOpen,
        permission: 'ledger'
      }
    ]
  },
  {
    label: 'Stammdaten',
    items: [
      {
        label: 'Leistungen, Material, Artikel',
        href: '/items',
        icon: Package,
        permission: 'items'
      },
      {
        label: 'Reifenkatalog',
        href: '/tires',
        icon: CircleDot,
        permission: 'tires'
      },
      {
        label: 'Lieferanten',
        href: '/suppliers',
        icon: Truck,
        permission: 'suppliers'
      }
    ]
  },
  {
    label: 'Personal',
    items: [
      {
        label: 'Mitarbeiter',
        href: '/employees',
        icon: Users2,
        permission: 'employees'
      },
      {
        // Visible to anyone who can at least log their own hours; the
        // page itself surfaces the "Alle" tab + report links only to
        // callers that also hold the full `hours` module.
        label: 'Stunden',
        href: '/hours',
        icon: Wallet,
        permission: 'hours:write_own'
      }
    ]
  },
  {
    label: 'Finanzen',
    items: [
      {
        label: 'Buchhaltung',
        href: '/ledger',
        icon: Calculator,
        permission: 'ledger'
      }
    ]
  },
  {
    label: 'Kommunikation',
    items: [
      {
        label: 'Rundschreiben',
        href: '/mailings',
        icon: Mail,
        permission: 'mailings'
      },
      { label: 'Gesendet', href: '/sent', icon: Send, permission: 'invoices' }
    ]
  },
  {
    label: 'System',
    items: [
      {
        label: 'Einstellungen',
        href: '/settings',
        icon: Settings,
        permission: 'settings'
      },
      {
        label: 'Versandoptionen',
        href: '/settings/shipping',
        icon: Truck,
        permission: 'shipping'
      },
      {
        label: 'Öffnungszeiten',
        href: '/settings/workshop-hours',
        icon: Clock,
        permission: 'settings'
      },
      {
        label: 'Anfragen',
        href: '/settings/inquiries',
        icon: Inbox,
        permission: 'mailings'
      },
      {
        label: 'Import (Kfz-Kaufmann)',
        href: '/import',
        icon: Database,
        permission: 'import'
      }
    ]
  }
]
