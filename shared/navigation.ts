/**
 * Die Seitennavigation: acht Gruppen, Reihenfolge und Beschriftungen wie im
 * Vorgängersystem.
 *
 * Sie liegt in `shared/`, weil der Server für `/api/me` dieselbe Liste braucht
 * wie die Oberfläche — und weil sich so prüfen lässt, dass jeder Eintrag auf
 * ein Modul zeigt, das es wirklich gibt.
 *
 * Zwei Dinge sind anders als im Bestand:
 *
 *   - Ein Eintrag nennt **Module**, keine einzelnen Berechtigungsschlüssel.
 *     Der Eintrag „Stunden" verlangte genau `hours:write_own`, sodass eine
 *     Rolle mit vollem Zugriff ihn verlor (B-058). Diesen Eintrag gibt es
 *     nicht mehr — das Muster bleibt, denn der Fehler hing nicht an ihm.
 *   - Ein Eintrag darf **mehrere** Module nennen. „Gesendet" stand nur unter
 *     `invoices`, während der Endpoint dahinter auch Angebote, Erinnerungen
 *     und Rundschreiben ausliefert — wer Rundschreiben verschickt, sah seine
 *     eigene Versandhistorie nicht (B-375).
 */
import type { ModuleKey } from './permissions'

export type NavItem = {
  label: string
  to: string
  /** Iconify-Name aus der Lucide-Sammlung, z. B. `i-lucide-users`. */
  icon: string
  /**
   * Nur genau dieser Pfad zählt als aktiv. Für die Startseite nötig, sonst
   * wäre sie auf jeder Unterseite mitmarkiert.
   */
  exact?: boolean
  /**
   * Module, die den Eintrag sichtbar machen. Eines genügt. Ohne Angabe sieht
   * ihn jeder Angemeldete.
   */
  modules?: ModuleKey[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Übersicht',
    items: [
      { label: 'Start', to: '/', icon: 'i-lucide-layout-dashboard', exact: true },
      { label: 'Kalender', to: '/calendar', icon: 'i-lucide-calendar-days', modules: ['calendar'] },
    ],
  },
  {
    label: 'Kunden & Fahrzeuge',
    items: [
      { label: 'Kunden', to: '/customers', icon: 'i-lucide-users', modules: ['customers'] },
      { label: 'Fahrzeuge', to: '/vehicles', icon: 'i-lucide-car', modules: ['vehicles'] },
      {
        label: 'Zu verkaufende Fahrzeuge',
        to: '/inventory',
        icon: 'i-lucide-warehouse',
        modules: ['inventory'],
      },
      { label: 'Reifenlager', to: '/tire-storage', icon: 'i-lucide-disc-3', modules: ['tires'] },
    ],
  },
  {
    label: 'Aufträge & Rechnungen',
    items: [
      { label: 'Aufträge', to: '/orders', icon: 'i-lucide-clipboard-list', modules: ['orders'] },
      {
        label: 'Angebote / Kostenvoranschläge',
        to: '/offers',
        icon: 'i-lucide-file-text',
        modules: ['offers'],
      },
      { label: 'Rechnungen', to: '/invoices', icon: 'i-lucide-receipt', modules: ['invoices'] },
      {
        // Das Modul ist die Liste der offenen Posten. Das Wort
        // „Zahlungserinnerung" bleibt der Versandaktion darin vorbehalten.
        label: 'Offene Rechnungen',
        to: '/reminders',
        icon: 'i-lucide-triangle-alert',
        modules: ['reminders'],
      },
      {
        label: 'Rechnungsausgangsbuch',
        to: '/sales-ledger',
        icon: 'i-lucide-book-open',
        modules: ['ledger'],
      },
    ],
  },
  {
    label: 'Stammdaten',
    items: [
      {
        label: 'Leistungen, Material, Artikel',
        to: '/items',
        icon: 'i-lucide-package',
        modules: ['items'],
      },
      { label: 'Reifenkatalog', to: '/tires', icon: 'i-lucide-circle-dot', modules: ['tires'] },
      { label: 'Lieferanten', to: '/suppliers', icon: 'i-lucide-truck', modules: ['suppliers'] },
    ],
  },
  {
    label: 'Personal',
    items: [
      // Kein Eintrag „Stunden": die Zeiterfassung entfällt (M-10). Was dem
      // Kunden berechnet wird, steht an der Auftragsposition.
      { label: 'Mitarbeiter', to: '/employees', icon: 'i-lucide-users-round', modules: ['employees'] },
    ],
  },
  {
    label: 'Finanzen',
    items: [
      { label: 'Buchhaltung', to: '/ledger', icon: 'i-lucide-calculator', modules: ['ledger'] },
    ],
  },
  {
    label: 'Kommunikation',
    items: [
      { label: 'Rundschreiben', to: '/mailings', icon: 'i-lucide-mail', modules: ['mailings'] },
      {
        // B-375: die Historie zeigt Rechnungen, Angebote, Erinnerungen und
        // Rundschreiben. Wer eines davon verschickt, darf sie sehen.
        label: 'Gesendet',
        to: '/sent',
        icon: 'i-lucide-send',
        modules: ['invoices', 'offers', 'reminders', 'mailings'],
      },
      {
        label: 'Aktuelle Informationen',
        to: '/posts',
        icon: 'i-lucide-newspaper',
        modules: ['posts'],
      },
      {
        // Anfragen sind Kommunikation, keine Systemverwaltung — die Seite
        // liegt technisch unter /settings, der Eintrag steht hier.
        label: 'Anfragen',
        to: '/settings/inquiries',
        icon: 'i-lucide-inbox',
        modules: ['mailings'],
      },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Einstellungen', to: '/settings', icon: 'i-lucide-settings', modules: ['settings'] },
    ],
  },
] as const

/**
 * Die Navigation, auf das gefiltert, was jemand sehen darf.
 *
 * Eine Gruppe, deren Einträge alle wegfallen, verschwindet mit. Wer gar kein
 * Modul hat, behält „Start" — eine leere Leiste wäre eine Sackgasse.
 */
export function visibleNavigation(
  can: (module: ModuleKey) => boolean,
  groups: readonly NavGroup[] = NAVIGATION,
): NavGroup[] {
  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(item => !item.modules || item.modules.some(can)),
    }))
    .filter(group => group.items.length > 0)
}

/** Alle sichtbaren Einträge am Stück, für die Suche nach dem aktiven. */
const flatten = (groups: readonly NavGroup[]) => groups.flatMap(group => group.items)

/**
 * Der Eintrag, der zum Pfad gehört — der **längste** passende, nicht jeder
 * passende.
 *
 * Der Vorgänger markierte per Präfix und hatte auf `/settings/inquiries`
 * gleichzeitig „Einstellungen" und „Anfragen" hervorgehoben (B-043).
 */
export function activeItem(path: string, groups: readonly NavGroup[] = NAVIGATION): NavItem | undefined {
  const clean = (path.split('?')[0] ?? path).replace(/\/+$/, '') || '/'

  let best: NavItem | undefined
  for (const item of flatten(groups)) {
    const matches = item.exact
      ? clean === item.to
      : clean === item.to || clean.startsWith(`${item.to}/`)
    if (!matches) continue
    if (!best || item.to.length > best.to.length) best = item
  }
  return best
}

/** Die Beschriftung für Kopfzeile und Dokumenttitel. */
export function titleFor(path: string, groups: readonly NavGroup[] = NAVIGATION): string {
  return activeItem(path, groups)?.label ?? 'TwinCarsManager'
}
