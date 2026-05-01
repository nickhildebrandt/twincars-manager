<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { navigation } from './navigation'
  import { Menu as MenuIcon, Wrench, ArrowLeft, Plus } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { pageHeader } from '$lib/stores/page-title.svelte'

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

  const handleBack = () => {
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
    <!-- Top header (matches sidebar header height for clean horizontal alignment) -->
    <header
      class="navbar sticky top-0 z-30 {TOP_BAR_HEIGHT} border-base-300 bg-base-100 min-h-0 border-b px-4 shadow-sm"
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
    </header>

    <!-- Page content -->
    <main class="scroll-y flex-1 p-4 sm:p-6 lg:p-8">
      {@render children?.()}
    </main>

    <footer
      class="border-base-300 bg-base-100 text-base-content/60 border-t px-4 py-2 text-xs"
    >
      <span>TwinCarsManager · v0.0.1</span>
    </footer>
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

      <nav class="scroll-y flex-1 px-2 py-3">
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
