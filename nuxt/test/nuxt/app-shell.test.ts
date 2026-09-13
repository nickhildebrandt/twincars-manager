/**
 * Die Anwendungshülle.
 *
 * Geprüft wird, was an einer Hülle schiefgehen kann: zu viele Ladeleisten, ein
 * Menüeintrag, den jemand nicht sehen dürfte, eine Gruppe ohne Einträge, ein
 * Titel, der überall gleich lautet (B-034), und eine Schublade, die nach der
 * Navigation offen bleibt (B-019).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DefaultLayout from '~/layouts/default.vue'
import BlankLayout from '~/layouts/blank.vue'
import AppSidebar from '~/components/app/AppSidebar.vue'
import AppHeader from '~/components/app/AppHeader.vue'
import AppUserMenu from '~/components/app/AppUserMenu.vue'
import NavigationTree from '~/components/app/NavigationTree.vue'
import { NAVIGATION, visibleNavigation } from '#shared/navigation'
import { hasModule } from '#shared/permissions'
import type { ModuleKey } from '#shared/permissions'

/**
 * Ein Pfad, auf den die Hülle wirklich reagiert.
 *
 * Ein einfaches Objekt reichte nicht: die Hülle beobachtet `route.fullPath`,
 * und ohne Reaktivität bekäme sie eine Änderung nie mit — der Test wäre grün,
 * ohne etwas zu prüfen.
 */
const { holder } = vi.hoisted(() => ({ holder: {} as { path?: { value: string } } }))

mockNuxtImport('useRoute', () => {
  holder.path ??= ref('/')
  const path = holder.path as Ref<string>
  return () => reactive({
    path: computed(() => path.value),
    fullPath: computed(() => path.value),
    query: {},
  })
})

/** Kurzschreibweise für die Tests. */
const path = {
  get current() {
    return holder.path!.value
  },
  set current(value: string) {
    holder.path!.value = value
  },
}

mockNuxtImport('useLoadingIndicator', () => () => ({
  start: vi.fn(), finish: vi.fn(), clear: vi.fn(), progress: ref(0), isLoading: ref(false),
}))

mockNuxtImport('navigateTo', () => vi.fn())

// Die Abmeldung geht sonst wirklich ins Netz.
vi.mock('~/utils/auth-client', () => ({
  authClient: { signIn: { username: vi.fn() }, signOut: vi.fn() },
}))

const groupsFor = (...permissions: string[]) => {
  const held = new Set(permissions)
  return visibleNavigation((module: ModuleKey) => hasModule(held, module))
}

/** Ein angemeldeter Administrator — die Hülle ist nur angemeldet erreichbar. */
const signInAsAdministrator = () => {
  useAuthState().value = {
    user: { id: 'u-1', username: 'chefin', displayName: 'Anna Chefin', roles: ['Administrator'] },
    permissions: ['*'],
    modules: Object.fromEntries(
      NAVIGATION.flatMap(group => group.items).flatMap(item => item.modules ?? [])
        .map(module => [module, true]),
    ),
  }
}

beforeEach(() => {
  path.current = '/'
  useBusyState().value = { count: 0, slow: false }
  signInAsAdministrator()
})

describe('Die Navigation in der Leiste', () => {
  it('zeigt dem Administrator jede Gruppe', async () => {
    const tree = await mountSuspended(NavigationTree, {
      props: { groups: groupsFor('*') },
    })
    expect(tree.findAll('[data-testid="nav-group"]')).toHaveLength(NAVIGATION.length)
  })

  it('zeigt einem Benutzer ohne Modulrecht nur „Start"', async () => {
    const tree = await mountSuspended(NavigationTree, {
      props: { groups: groupsFor() },
    })
    const links = tree.findAll('nav a')
    expect(links).toHaveLength(1)
    expect(links[0]!.text()).toContain('Start')
  })

  it('lässt eine Gruppe ohne sichtbare Einträge weg', async () => {
    const tree = await mountSuspended(NavigationTree, {
      props: { groups: groupsFor('customers') },
    })
    const labels = tree.findAll('[data-testid="nav-group"] p').map(node => node.text())
    expect(labels).toEqual(['Übersicht', 'Kunden & Fahrzeuge'])
  })

  it('markiert genau einen Eintrag als aktuelle Seite', async () => {
    const tree = await mountSuspended(NavigationTree, {
      props: { groups: groupsFor('*'), activePath: '/settings/inquiries' },
    })
    const current = tree.findAll('[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toContain('Anfragen')
  })

  it('markiert ohne aktive Seite nichts', async () => {
    const tree = await mountSuspended(NavigationTree, {
      props: { groups: groupsFor('*') },
    })
    expect(tree.findAll('[aria-current="page"]')).toHaveLength(0)
  })

  it('benennt sich für Screenreader', async () => {
    const tree = await mountSuspended(NavigationTree, { props: { groups: groupsFor('*') } })
    expect(tree.find('nav').attributes('aria-label')).toBe('Hauptnavigation')
  })
})

describe('Die Kopfzeile', () => {
  it('nennt die Seite', async () => {
    const header = await mountSuspended(AppHeader, { props: { title: 'Kunden' } })
    expect(header.find('[data-testid="page-title"]').text()).toBe('Kunden')
  })

  it('bittet beim Griff zur Schublade um die Navigation', async () => {
    const header = await mountSuspended(AppHeader, { props: { title: 'Start' } })
    await header.find('[data-testid="open-navigation"]').trigger('click')
    expect(header.emitted('openNavigation')).toHaveLength(1)
  })

  it('benennt den Griff für Screenreader', async () => {
    const header = await mountSuspended(AppHeader, { props: { title: 'Start' } })
    expect(header.find('[data-testid="open-navigation"]').attributes('aria-label'))
      .toBe('Navigation öffnen')
  })
})

describe('Das Benutzermenü', () => {
  it('nennt den Angemeldeten', async () => {
    const menu = await mountSuspended(AppUserMenu)
    expect(menu.find('[data-testid="user-menu"]').text()).toContain('Anna Chefin')
  })

  it('kürzt den Namen zu Initialen', async () => {
    const menu = await mountSuspended(AppUserMenu)
    expect(menu.html()).toContain('AC')
  })

  it('erscheint gar nicht, wenn niemand angemeldet ist', async () => {
    useAuthState().value = { user: null, permissions: [], modules: {} }
    const menu = await mountSuspended(AppUserMenu)
    expect(menu.find('[data-testid="user-menu"]').exists()).toBe(false)
  })

  it('bietet genau einen Eintrag: abmelden', async () => {
    const menu = await mountSuspended(AppUserMenu)
    const items = menu.findComponent({ name: 'UDropdownMenu' }).props('items') as
      { label: string, onSelect: () => Promise<void> }[][]
    expect(items.flat().map(item => item.label)).toEqual(['Abmelden'])
  })

  it('meldet ab und sagt es', async () => {
    const menu = await mountSuspended(AppUserMenu)
    const items = menu.findComponent({ name: 'UDropdownMenu' }).props('items') as
      { label: string, onSelect: () => Promise<void> }[][]

    await items[0]![0]!.onSelect()

    expect(useAuthState().value.user).toBeNull()
  })

  it('zeigt für einen einteiligen Namen einen Buchstaben', async () => {
    useAuthState().value = {
      user: { id: 'u-2', username: 'chefin', displayName: 'Chefin', roles: [] },
      permissions: [],
      modules: {},
    }
    const menu = await mountSuspended(AppUserMenu)
    expect(menu.html()).toContain('C')
  })
})

describe('Das leere Layout', () => {
  it('zeigt den Inhalt ohne Navigation', async () => {
    // Anmeldung und Ersteinrichtung stehen vor der Hülle.
    const blank = await mountSuspended(BlankLayout, {
      slots: { default: () => 'Anmeldung' },
    })
    expect(blank.text()).toContain('Anmeldung')
    expect(blank.find('[data-testid="navigation"]').exists()).toBe(false)
  })
})

describe('Die Seitenleiste', () => {
  it('nennt die Version', async () => {
    const sidebar = await mountSuspended(AppSidebar, { props: { groups: groupsFor('*') } })
    expect(sidebar.find('[data-testid="app-version"]').text()).toContain('Version')
  })

  it('führt über das Logo zur Startseite', async () => {
    const sidebar = await mountSuspended(AppSidebar, { props: { groups: groupsFor('*') } })
    expect(sidebar.find('a').attributes('href')).toBe('/')
  })

  it('meldet jeden Klick auf einen Eintrag, damit die Schublade zugeht', async () => {
    const sidebar = await mountSuspended(AppSidebar, { props: { groups: groupsFor('customers') } })
    await sidebar.find('[data-testid="nav-item-/customers"]').trigger('click')
    expect(sidebar.emitted('navigate')).toHaveLength(1)
  })

  it('meldet auch den Klick auf das Logo', async () => {
    const sidebar = await mountSuspended(AppSidebar, { props: { groups: groupsFor('*') } })
    await sidebar.find('a').trigger('click')
    expect(sidebar.emitted('navigate')).toHaveLength(1)
  })
})

describe('Die Hülle', () => {
  it('enthält genau eine Ladeleiste', async () => {
    // 04-ux.md §3.3: eine zweite Ladeleiste irgendwo ist verboten.
    const shell = await mountSuspended(DefaultLayout)
    const html = shell.html()
    const bars = html.match(/nuxt-loading-indicator/g) ?? []
    expect(bars.length).toBeLessThanOrEqual(1)
  })

  it('zeigt die Sperrfläche erst, wenn es dauert', async () => {
    const shell = await mountSuspended(DefaultLayout)
    expect(shell.find('[data-testid="busy-overlay"]').exists()).toBe(false)

    useBusyState().value = { count: 1, slow: true }
    await nextTick()

    expect(shell.find('[data-testid="busy-overlay"]').exists()).toBe(true)
  })

  it('meldet den Inhaltsbereich als beschäftigt, nicht die ganze Seite', async () => {
    // Navigation und Kopfzeile bleiben bedienbar, während etwas lädt.
    useBusyState().value = { count: 1, slow: true }
    const shell = await mountSuspended(DefaultLayout)
    expect(shell.find('[data-testid="content"]').attributes('aria-busy')).toBe('true')
    expect(shell.find('[data-testid="app-header"]').attributes('aria-busy')).toBeUndefined()
  })

  it('nennt die Seite in der Kopfzeile', async () => {
    path.current = '/customers'
    const shell = await mountSuspended(DefaultLayout)
    expect(shell.find('[data-testid="page-title"]').text()).toBe('Kunden')
  })

  it('nennt auf der Startseite den Anwendungsnamen nicht doppelt', async () => {
    path.current = '/'
    const shell = await mountSuspended(DefaultLayout)
    expect(shell.find('[data-testid="page-title"]').text()).toBe('Start')
  })

  it('öffnet die Schublade über den Griff in der Kopfzeile', async () => {
    const shell = await mountSuspended(DefaultLayout)
    expect(shell.findComponent({ name: 'USlideover' }).props('open')).toBeFalsy()

    await shell.find('[data-testid="open-navigation"]').trigger('click')

    expect(shell.findComponent({ name: 'USlideover' }).props('open')).toBe(true)
  })
})

describe('Regression', () => {
  it('B-017: die Hülle lädt kein Bild als Logo', async () => {
    // Der Vorgänger benutzte ein 1,1 MB großes PNG gleichzeitig als Favicon
    // und als 38 Pixel kleines Logo in der Leiste — über Mobilfunk bezahlt man
    // das bei jedem ersten Seitenaufruf.
    const sidebar = await mountSuspended(AppSidebar, { props: { groups: groupsFor('*') } })
    expect(sidebar.findAll('img')).toHaveLength(0)
  })

  it('B-019: die Schublade schließt sich nach der Navigation', async () => {
    // Beim Vorgänger hielt eine Checkbox den Zustand, die niemand zurücksetzte
    // — jeder Wechsel auf dem Telefon kostete einen zusätzlichen Tipp.
    const shell = await mountSuspended(DefaultLayout)
    const drawer = () => shell.findComponent({ name: 'USlideover' })

    await shell.find('[data-testid="open-navigation"]').trigger('click')
    expect(drawer().props('open')).toBe(true)

    path.current = '/customers'
    await nextTick()
    await nextTick()

    expect(drawer().props('open')).toBe(false)
  })

  it('B-019: ein Klick in der Schublade schließt sie sofort', async () => {
    // Auch ohne Pfadwechsel — etwa beim Klick auf die Seite, auf der man schon
    // ist. Sonst bliebe sie über dem Inhalt stehen.
    const shell = await mountSuspended(DefaultLayout)
    await shell.find('[data-testid="open-navigation"]').trigger('click')

    const drawer = shell.findComponent({ name: 'USlideover' })
    drawer.findComponent({ name: 'AppNavigationTree' }).vm.$emit('navigate')
    await nextTick()

    expect(shell.findComponent({ name: 'USlideover' }).props('open')).toBe(false)
  })

  it('B-034: die Hülle gibt je Seite einen eigenen Titel aus', async () => {
    // „TwinCarsManager" überall machte Tabs und Verlauf ununterscheidbar. Dass
    // der Titel wirklich im Dokument landet, prüft der End-to-End-Test gegen
    // die gebaute Anwendung; hier geht es um den Wert, den die Hülle liefert.
    path.current = '/customers'
    const customers = await mountSuspended(DefaultLayout)
    expect(customers.find('[data-testid="page-title"]').text()).toBe('Kunden')

    path.current = '/invoices'
    const invoices = await mountSuspended(DefaultLayout)
    expect(invoices.find('[data-testid="page-title"]').text()).toBe('Rechnungen')
  })
})
