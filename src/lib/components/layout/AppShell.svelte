<script lang="ts">
  import { goto, beforeNavigate, afterNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { navigation } from './navigation'
  import { Menu as MenuIcon, Wrench, ArrowLeft, Plus } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { pageHeader } from '$lib/stores/page-title.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import Loader from '$lib/components/ui/Loader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'

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

  type Props = { children?: Snippet; companyName?: string }
  const { children, companyName = 'TwinCarsManager' }: Props = $props()

  const isActive = (href: string, exact = false) => {
    const pathname = $page.url.pathname
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const routeTitle = $derived.by(() => {
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
      <div class="navbar-center">
        <h1
          class="truncate px-1 text-base font-semibold sm:text-lg"
          data-testid="page-title"
        >
          {currentTitle}
        </h1>
      </div>
      <div class="navbar-end gap-2">
        {#if primary}
          {@const Icon = primary.icon ?? Plus}
          {#if primary.href}
            <a
              class="btn btn-primary btn-sm gap-2"
              href={primary.href}
              data-testid="header-primary-action"
            >
              <Icon size={16} />
              <span>{primary.label}</span>
            </a>
          {:else}
            <button
              type="button"
              class="btn btn-primary btn-sm gap-2"
              onclick={handlePrimary}
              data-testid="header-primary-action"
            >
              <Icon size={16} />
              <span>{primary.label}</span>
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
      class="relative flex-1 overflow-y-auto p-4 pb-12 [scrollbar-gutter:stable]"
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
        <div class="bg-primary/10 text-primary rounded-lg p-2">
          <Wrench size={22} />
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-base-content font-bold">{companyName}</span>
          <span class="text-base-content/60 text-xs">Werkstatt-Manager</span>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-3 [scrollbar-gutter:stable]">
        {#each navigation as group (group.label)}
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

      <div
        class="border-base-300 text-base-content/50 border-t px-4 py-2 text-[11px]"
      >
        v0.0.1 · {new Date().getFullYear()}
      </div>
    </div>
  </aside>
</div>

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
