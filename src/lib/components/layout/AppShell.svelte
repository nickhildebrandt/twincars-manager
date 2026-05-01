<script lang="ts">
  import { page } from '$app/stores'
  import { navigation } from './navigation'
  import {
    Menu as MenuIcon,
    Search,
    Plus,
    Bell,
    Sun,
    Moon,
    Wrench
  } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  type Props = { children?: Snippet; companyName?: string }
  const { children, companyName = 'TwinCarsManager' }: Props = $props()

  let theme = $state<'corporate' | 'business'>('corporate')

  const toggleTheme = () => {
    theme = theme === 'corporate' ? 'business' : 'corporate'
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  const isActive = (href: string, exact = false) => {
    const pathname = $page.url.pathname
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  const currentTitle = $derived.by(() => {
    const all = navigation.flatMap((g) => g.items)
    const exactMatch = all.find((i) => i.exact && i.href === $page.url.pathname)
    if (exactMatch) return exactMatch.label
    const prefixMatch = all
      .filter((i) => !i.exact)
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => $page.url.pathname.startsWith(i.href))
    return prefixMatch?.label ?? 'TwinCarsManager'
  })
</script>

<div class="drawer lg:drawer-open">
  <input id="app-drawer" type="checkbox" class="drawer-toggle" />

  <div class="drawer-content bg-base-200 flex min-h-dvh flex-col">
    <!-- Top header -->
    <header
      class="navbar border-base-300 bg-base-100 sticky top-0 z-30 border-b px-3 shadow-sm"
    >
      <div class="navbar-start gap-2">
        <label
          for="app-drawer"
          aria-label="Navigation öffnen"
          class="btn btn-ghost btn-square lg:hidden"
        >
          <MenuIcon size={22} />
        </label>
        <h1 class="px-2 text-base font-semibold sm:text-lg">{currentTitle}</h1>
      </div>

      <div class="navbar-end gap-2">
        <label class="input input-sm hidden w-64 md:flex">
          <Search size={16} class="opacity-60" />
          <input type="search" placeholder="Suchen…" class="grow" />
        </label>

        <a class="btn btn-primary btn-sm gap-2" href="/customers/new">
          <Plus size={16} />
          <span class="hidden sm:inline">Neu</span>
        </a>

        <button
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Benachrichtigungen"
        >
          <Bell size={18} />
        </button>

        <button
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Theme umschalten"
          onclick={toggleTheme}
        >
          {#if theme === 'corporate'}
            <Moon size={18} />
          {:else}
            <Sun size={18} />
          {/if}
        </button>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1 p-4 sm:p-6 lg:p-8">
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

    <div class="bg-base-100 border-base-300 flex h-dvh w-72 flex-col border-r">
      <div class="border-base-300 flex items-center gap-2 border-b px-4 py-4">
        <div class="bg-primary/10 text-primary rounded-lg p-2">
          <Wrench size={22} />
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-base-content font-bold">{companyName}</span>
          <span class="text-base-content/60 text-xs">Werkstatt-Manager</span>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-3">
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
