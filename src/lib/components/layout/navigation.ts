import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Car,
  Warehouse,
  CalendarClock,
  FileText,
  Receipt,
  AlertTriangle,
  BookOpen,
  Package,
  Truck,
  Users2,
  Wallet,
  Calculator,
  LineChart,
  Mail,
  Send,
  Settings,
  Database
} from '@lucide/svelte'
import type { Component } from 'svelte'

export type NavItem = {
  label: string
  href: string
  icon: Component
  exact?: boolean
}

export type NavGroup = { label: string; items: NavItem[] }

/**
 * Sidebar navigation grouped by area. Used by the app shell.
 */
export const navigation: NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, exact: true },
      { label: 'Kalender', href: '/calendar', icon: CalendarDays }
    ]
  },
  {
    label: 'Kunden & Fahrzeuge',
    items: [
      { label: 'Kunden', href: '/customers', icon: Users },
      { label: 'Fahrzeuge', href: '/vehicles', icon: Car },
      { label: 'Fahrzeugbestand', href: '/inventory', icon: Warehouse },
      { label: 'Termine', href: '/appointments', icon: CalendarClock }
    ]
  },
  {
    label: 'Aufträge & Rechnungen',
    items: [
      {
        label: 'Angebote / Kostenvoranschläge',
        href: '/offers',
        icon: FileText
      },
      { label: 'Rechnungen', href: '/invoices', icon: Receipt },
      {
        label: 'Offene Rechnungen & Mahnungen',
        href: '/reminders',
        icon: AlertTriangle
      },
      { label: 'Rechnungsausgangsbuch', href: '/sales-ledger', icon: BookOpen }
    ]
  },
  {
    label: 'Stammdaten',
    items: [
      { label: 'Leistungen, Material, Artikel', href: '/items', icon: Package },
      { label: 'Lieferanten', href: '/suppliers', icon: Truck }
    ]
  },
  {
    label: 'Personal',
    items: [
      { label: 'Mitarbeiter', href: '/employees', icon: Users2 },
      { label: 'Lohn und Gehalt', href: '/payroll', icon: Wallet }
    ]
  },
  {
    label: 'Finanzen',
    items: [
      { label: 'Buchhaltung', href: '/ledger', icon: Calculator },
      { label: 'Controlling', href: '/controlling', icon: LineChart }
    ]
  },
  {
    label: 'Kommunikation',
    items: [
      { label: 'Serienbriefe', href: '/mailings', icon: Mail },
      { label: 'Gesendet', href: '/sent', icon: Send }
    ]
  },
  {
    label: 'System',
    items: [
      { label: 'Einstellungen', href: '/settings', icon: Settings },
      { label: 'Import (Kfz-Kaufmann)', href: '/import', icon: Database }
    ]
  }
]
