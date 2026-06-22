<script lang="ts">
  import { goto, beforeNavigate, afterNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { navigation, filterNavigationByPermissions } from './navigation'
  import {
    Menu as MenuIcon,
    ArrowLeft,
    Plus,
    LogOut,
    User as UserIcon,
    Search as SearchIcon
  } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { pageHeader } from '$lib/stores/page-title.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import GlobalSearch from '$lib/components/ui/GlobalSearch.svelte'
  import { authClient } from '$lib/client/auth-client'
  import { handleClientError } from '$lib/utils/client-error'
  import { startIdleLogout } from '$lib/stores/idle-logout.svelte'

  /** Auto-logout after 1 hour of inactivity (per project spec). */
  const IDLE_LOGOUT_MS = 60 * 60 * 1000

  /**
   * Globale Unsaved-Changes-Sperre. Forms melden ungespeicherte
   * Änderungen über `formDirty.set(true)`. Wir blockieren beide
   * Wege weg vom Formular:
   *
   *   - In-App-Navigation (Sidebar-Klick, Back-Button) →
   *     `beforeNavigate` cancelt, öffnet einen App-internen
   *     `ConfirmDialog`. Nach Bestätigung wird das ursprüngliche Ziel
   *     erneut angesteuert.
   *   - Tab-Close / Reload → `beforeunload` (Browser-eigene Warnung
   *     ist nicht anpassbar, aber sie kommt).
   */
  let unsavedOpen = $state(false)
  let pendingTarget: string | null = null

  beforeNavigate((nav) => {
    if (!formDirty.dirty) return
    if (nav.type === 'leave') return // separat über beforeunload
    // Wenn der User bereits zugestimmt hat, das Form zu verwerfen, ist
    // `formDirty` schon gecleart und wir landen gar nicht hier.
    nav.cancel()
    pendingTarget = nav.to?.url.pathname
      ? `${nav.to.url.pathname}${nav.to.url.search}`
      : null
    unsavedOpen = true
  })

  const discardAndNavigate = () => {
    formDirty.clear()
    const target = pendingTarget
    pendingTarget = null
    unsavedOpen = false
    if (target) goto(target)
  }

  $effect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: BeforeUnloadEvent) => {
      if (!formDirty.dirty) return
      e.preventDefault()
      // Older browsers want a returnValue; newer ones ignore it
      // and just show their generic prompt when preventDefault was
      // called.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  })

  type CurrentUser = {
    id: string
    username: string | null
    name: string
    permissions: string[]
  } | null

  type Props = {
    children?: Snippet
    companyName?: string
    currentUser?: CurrentUser
  }
  const {
    children,
    companyName = 'TwinCarsManager',
    currentUser = null
  }: Props = $props()

  const permissionSet = $derived(new Set(currentUser?.permissions ?? []))
  const visibleNavigation = $derived(
    filterNavigationByPermissions(navigation, permissionSet)
  )

  async function handleLogout() {
    try {
      await busy.run(async () => {
        await authClient.signOut()
        await goto('/login', { invalidateAll: true, replaceState: true })
      })
    } catch (err) {
      handleClientError(err, 'Abmeldung fehlgeschlagen.')
    }
  }

  /**
   * Idle-logout: signs the user out automatically after 1h of no
   * mousemove / keydown / click / scroll / touch. Only armed while a
   * user is signed in (the public /login and /setup pages never see
   * this component instance because the root layout branches there).
   */
  $effect(() => {
    if (!currentUser) return
    return startIdleLogout({
      timeoutMs: IDLE_LOGOUT_MS,
      onLogout: async () => {
        try {
          await authClient.signOut()
        } catch {
          // Network outage: still surface the login screen so the
          // workstation isn't left with privileged UI on screen.
        }
        await goto('/login?reason=idle', {
          invalidateAll: true,
          replaceState: true
        })
      }
    })
  })

  const isActive = (href: string, exact = false) => {
    const pathname = $page.url.pathname
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const routeTitle = $derived.by(() => {
    // Title resolution uses the full navigation map (not the
    // permission-filtered one) so a deep link to a route the user
    // can still load — but no longer sees in the sidebar — still
    // gets a meaningful header title.
    const all = navigation.flatMap((g) => g.items)
    const exactMatch = all.find((i) => i.exact && i.href === $page.url.pathname)
    if (exactMatch) return exactMatch.label
    const prefixMatch = all
      .filter((i) => !i.exact)
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => $page.url.pathname.startsWith(i.href))
    return prefixMatch?.label ?? 'TwinCarsManager'
  })

  const currentTitle = $derived(pageHeader.title ?? routeTitle)
  const back = $derived(pageHeader.backTarget)
  const primary = $derived(pageHeader.primaryAction)

  /**
   * Tracks whether the user has already navigated within the app
   * since the session started. If yes, the Zurück-Button uses
   * `window.history.back()` so the browser's actual previous page
   * is honored — e.g. /reminders → /invoices/[id] → back lands on
   * /reminders, not on /invoices (which is what a static
   * `back="/invoices"` would do).
   *
   * If the user landed via a deep link (no in-app navigation yet),
   * we fall back to the page's configured `backTarget` so the
   * button still has a meaningful target.
   */
  let hasInAppHistory = $state(false)
  afterNavigate((nav) => {
    if (nav.from && nav.type !== 'enter') {
      hasInAppHistory = true
    }
  })

  const handleBack = () => {
    if (hasInAppHistory && typeof window !== 'undefined') {
      window.history.back()
      return
    }
    const target = pageHeader.backTarget
    if (typeof target === 'function') {
      target()
      return
    }
    if (typeof target === 'string') {
      goto(target)
      return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    }
  }

  const handlePrimary = () => {
    const a = pageHeader.primaryAction
    if (!a) return
    if (a.href) goto(a.href)
    else if (a.onClick) a.onClick()
  }

  // Shared height for the header bar AND the sidebar logo block, so both
  // align perfectly along the same horizontal divider line.
  const TOP_BAR_HEIGHT = 'h-[68px]'

  /**
   * Global search modal — bound to `searchOpen`. The trigger in the
   * navbar opens it; Cmd/Ctrl+K opens it from anywhere; Esc inside
   * the modal closes it.
   */
  let searchOpen = $state(false)

  /**
   * On a Mac we display ⌘K, on every other platform Strg+K. The
   * detection runs once on the client; SSR shows the Mac glyph
   * (harmless — it's hidden on small screens anyway).
   */
  const isMac = $derived.by(() => {
    if (typeof navigator === 'undefined') return false
    return /mac|iphone|ipad|ipod/i.test(navigator.platform)
  })

  $effect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchOpen = true
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })
</script>

<div class="drawer lg:drawer-open">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" />

  <div class="drawer-content bg-base-200 flex min-h-dvh flex-col">
    <!--
      Top header (matches sidebar header height for clean horizontal
      alignment). The header is `relative` so the global loading bar can
      live inside it, anchored at the very bottom — overlaying the
      border-b instead of pushing content down. This is the single
      loading bar in the entire app: no other component owns one.
    -->
    <header
      class="navbar sticky top-0 z-30 {TOP_BAR_HEIGHT} border-base-300 bg-base-100 relative min-h-0 border-b px-4"
    >
      <div class="navbar-start gap-2">
        <label
          for="app-drawer"
          aria-label="Navigation öffnen"
          class="btn btn-ghost btn-square lg:hidden"
        >
          <MenuIcon size={22} />
        </label>
        {#if back}
          <button
            type="button"
            class="btn btn-ghost btn-sm gap-1"
            aria-label="Zurück"
            onclick={handleBack}
          >
            <ArrowLeft size={18} />
            <span class="hidden sm:inline">Zurück</span>
          </button>
        {/if}
      </div>
      <div class="navbar-center hidden w-full max-w-md md:flex">
        <button
          type="button"
          class="input input-bordered input-sm text-base-content/60 flex h-9 w-full items-center justify-between gap-2"
          aria-label="Globale Suche öffnen"
          onclick={() => (searchOpen = true)}
          data-testid="global-search-trigger"
        >
          <span class="flex items-center gap-2">
            <SearchIcon size={14} class="opacity-60" />
            <span>Suchen…</span>
          </span>
          <kbd class="kbd kbd-xs" aria-hidden="true">
            {isMac ? '⌘K' : 'Strg+K'}
          </kbd>
        </button>
      </div>
      <div class="navbar-center md:hidden">
        <h1
          class="truncate px-1 text-base font-semibold sm:text-lg"
          data-testid="page-title"
        >
          {currentTitle}
        </h1>
      </div>
      <div class="navbar-end gap-2">
        <!--
          Phone-only search trigger: the centered "Suchen…" input is hidden
          on <md so the page title can use the available space. A bare
          icon button keeps the global search accessible without crowding
          the navbar.
        -->
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm md:hidden"
          aria-label="Globale Suche öffnen"
          onclick={() => (searchOpen = true)}
        >
          <SearchIcon size={18} />
        </button>
        {#if primary}
          {@const Icon = primary.icon ?? Plus}
          {#if primary.href}
            <a
              class="btn btn-primary btn-sm gap-2"
              href={primary.href}
              data-testid="header-primary-action"
            >
              <Icon size={16} />
              <span class="hidden sm:inline">{primary.label}</span>
            </a>
          {:else}
            <button
              type="button"
              class="btn btn-primary btn-sm gap-2"
              onclick={handlePrimary}
              data-testid="header-primary-action"
            >
              <Icon size={16} />
              <span class="hidden sm:inline">{primary.label}</span>
            </button>
          {/if}
        {/if}
      </div>

      <!--
        The single global loading bar. Anchored at the bottom of the
        sticky header, overlapping the border-b. `position: absolute`
        plus `pointer-events-none` keeps it purely decorative — the
        layout below the header never shifts when the bar appears or
        disappears. Opacity is the only animated property.
      -->
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 transition-opacity duration-150"
        class:opacity-0={!busy.active}
        class:opacity-100={busy.active}
        aria-hidden={!busy.active}
        data-testid="global-loading-bar"
      >
        <progress
          class="progress progress-primary block h-full w-full"
          aria-label="Lädt"
        ></progress>
      </div>
    </header>

    <!--
      Page content. The wrapper is `relative` so the global busy overlay
      can sit on top of the current view (sidebar + header stay
      interactive). The overlay only appears when an operation has been
      running for ≥ 250 ms (`busy.slow`), so quick CRUD never flickers.
      During that slow window the slot is `aria-busy` and `inert`, blocking
      both pointer and keyboard interaction.
    -->
    <!--
      Card baseline: every block of content lives inside a flat
      `card border border-base-300 bg-base-100`. The shell uses the
      same `1rem / p-4` rhythm for the gap between cards AND for the
      padding around the main column. That way the header's `px-4`
      lines up exactly with the rightmost card edge below it — primary
      actions in the header sit directly above the cards' right edges.
      Bottom padding is doubled so the page never feels cramped at the
      end of a list.
    -->
    <main
      class="relative flex-1 [scrollbar-gutter:stable] overflow-y-auto p-4 pb-12"
      aria-busy={busy.slow}
      inert={busy.slow}
    >
      {@render children?.()}
      {#if busy.slow}
        <Loader variant="overlay" />
      {/if}
    </main>
  </div>

  <!-- Sidebar -->
  <aside class="drawer-side z-40">
    <label
      for="app-drawer"
      aria-label="Navigation schließen"
      class="drawer-overlay"
    ></label>

    <div class="border-base-300 bg-base-100 flex h-dvh w-72 flex-col border-r">
      <!-- Sidebar logo block — same height as header, single divider -->
      <div
        class="{TOP_BAR_HEIGHT} border-base-300 flex items-center gap-3 border-b px-4"
      >
        <img
          src="/icon.png"
          width="38"
          height="38"
          alt=""
          aria-hidden="true"
          class="rounded-lg"
        />
        <div class="flex flex-col leading-tight">
          <span class="text-base-content font-bold">{companyName}</span>
          <span class="text-base-content/60 text-xs">Werkstatt-Manager</span>
        </div>
      </div>

      <nav class="flex-1 [scrollbar-gutter:stable] overflow-y-auto px-2 py-3">
        {#each visibleNavigation as group (group.label)}
          <div class="mb-3">
            <div
              class="text-base-content/50 px-3 pb-1 text-[11px] font-semibold tracking-wider uppercase"
            >
              {group.label}
            </div>
            <ul class="menu menu-sm w-full p-0">
              {#each group.items as item (item.href)}
                {@const Icon = item.icon}
                <li>
                  <a
                    href={item.href}
                    class:menu-active={isActive(item.href, item.exact)}
                    class="gap-3"
                  >
                    <Icon size={18} class="shrink-0" />
                    <span class="truncate">{item.label}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </nav>

      {#if currentUser}
        <div class="border-base-300 border-t p-2">
          <div class="dropdown dropdown-top dropdown-end w-full">
            <button
              type="button"
              class="hover:bg-base-200 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left"
              aria-label="Benutzermenü"
              aria-haspopup="menu"
              data-testid="user-menu"
            >
              <div
                class="bg-primary/15 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              >
                <UserIcon size={18} />
              </div>
              <div class="flex min-w-0 flex-col leading-tight">
                <span class="text-base-content truncate text-sm font-medium">
                  {currentUser.name}
                </span>
                <span class="text-base-content/60 truncate text-xs">
                  {currentUser.username ?? 'Angemeldet'}
                </span>
              </div>
            </button>
            <ul
              role="menu"
              class="dropdown-content menu bg-base-100 border-base-300 z-50 mb-2 w-60 rounded-md border p-2 shadow-md"
            >
              <li class="menu-title">
                <span class="text-base-content/60 text-xs">
                  Angemeldet als {currentUser.username ?? currentUser.name}
                </span>
              </li>
              <li>
                <a href="/settings/account">
                  <UserIcon size={16} />
                  <span>Profil</span>
                </a>
              </li>
              <li>
                <button type="button" onclick={handleLogout}>
                  <LogOut size={16} />
                  <span>Abmelden</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      {/if}
    </div>
  </aside>
</div>

<GlobalSearch bind:open={searchOpen} />

<ConfirmDialog
  bind:open={unsavedOpen}
  title="Ungespeicherte Änderungen"
  message="Es gibt ungespeicherte Änderungen. Sollen sie verworfen werden?"
  confirmLabel="Verwerfen"
  cancelLabel="Bleiben"
  variant="danger"
  onConfirm={discardAndNavigate}
  onClose={() => {
    pendingTarget = null
  }}
/>
