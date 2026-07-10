<script lang="ts" module>
  import type { Component } from 'svelte'

  /**
   * One tab in a `TabGroup`. When `href` is set on EVERY tab the group
   * runs in navigation mode (route tabs, e.g. the settings section);
   * otherwise it runs in state mode (content tabs on one page).
   */
  export type TabItem = {
    /** Stable id — used as the radio value and the `?tab=` URL value. */
    id: string
    /** Visible German label; also the radio's aria-label. */
    label: string
    /** Optional lucide icon rendered before the label. */
    icon?: Component<{ size?: number | string }>
    /** Optional count/badge rendered after the label. */
    badge?: string | number
    /** Navigation mode: route this tab links to. */
    href?: string
    /** Navigation mode: match the pathname exactly (default: prefix). */
    exact?: boolean
  }
</script>

<script lang="ts">
  /**
   * The app-wide standard tab implementation: DaisyUI v5 `tabs-lift`
   * radio pattern — every `<label class="tab">` wraps its radio input
   * and is directly followed by its `<div class="tab-content">`, so the
   * CSS sibling selector toggles visibility natively. Radios in one
   * group share the (unique!) `name`, which gives keyboard operability
   * (arrow keys) for free.
   *
   * Two modes:
   * - **State mode** (default): the active tab lives in bindable
   *   `active` and is mirrored into the URL as `?tab=` via
   *   `replaceState` (deep links survive a reload; back-button never
   *   snaps between tabs). All panels stay mounted — DaisyUI hides
   *   inactive ones via CSS, so panel state (uploads, pagination)
   *   survives tab switches.
   * - **Navigation mode** (every tab has `href`): the active tab is
   *   derived from the current pathname and selecting a tab navigates
   *   via `goto`. Only the active panel renders its content (it IS the
   *   routed page). A cancelled navigation (unsaved-changes confirm)
   *   snaps the radio back.
   *
   * Never nest a TabGroup inside another TabGroup.
   */
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import { goto, replaceState } from '$app/navigation'

  type Props = {
    /** Radio group name — MUST be unique per tab group on the page. */
    name: string
    tabs: TabItem[]
    /** State mode: bindable active tab id (defaults from `?tab=`). */
    active?: string
    /**
     * State mode: URL search param mirroring the active tab.
     * Default `'tab'`; pass `null` to disable the URL sync.
     */
    urlParam?: string | null
    /** Extra classes on every `tab-content` panel (default `p-4`). */
    contentClass?: string
    /** Panel content, invoked per tab id. */
    content?: Snippet<[string]>
  }

  /** Initial active tab: valid `?tab=` value or the first tab. */
  function initialActive(
    items: TabItem[],
    param: string | null
  ): string | undefined {
    if (param) {
      const t = page.url.searchParams.get(param)
      if (t && items.some((x) => x.id === t)) return t
    }
    return items[0]?.id
  }

  let {
    name,
    tabs,
    urlParam = 'tab',
    contentClass = 'p-4',
    content,
    active = $bindable(initialActive(tabs, urlParam))
  }: Props = $props()

  /** Navigation mode iff every tab is a route link. */
  const isNav = $derived(tabs.length > 0 && tabs.every((t) => !!t.href))

  const matchTab = (t: TabItem, pathname: string): boolean =>
    !!t.href &&
    (t.exact
      ? pathname === t.href
      : pathname === t.href || pathname.startsWith(t.href + '/'))

  const navActiveFromUrl = (): string | undefined =>
    tabs.find((t) => matchTab(t, page.url.pathname))?.id

  /** Nav mode: radio state, re-synced from the URL on route changes. */
  let navValue = $state(navActiveFromUrl())

  $effect(() => {
    if (!isNav) return
    navValue = navActiveFromUrl()
  })

  /**
   * Nav mode: selecting a tab navigates. If the navigation is cancelled
   * (e.g. unsaved-changes confirm) the radio snaps back to the route.
   */
  const onNavSelect = async (tab: TabItem) => {
    if (!tab.href) return
    try {
      await goto(tab.href)
    } catch {
      navValue = navActiveFromUrl()
    }
  }

  /**
   * State mode: mirror the active tab into the URL (`replaceState` —
   * no history entry, so browser-back never toggles tabs). The first
   * tab is the default and clears the param.
   */
  $effect(() => {
    if (isNav || !urlParam) return
    const url = new URL(page.url)
    if (!active || active === tabs[0]?.id) url.searchParams.delete(urlParam)
    else url.searchParams.set(urlParam, active)
    if (url.search !== page.url.search) replaceState(url, page.state)
  })

  /** State mode: conditional tabs may disappear — fall back to first. */
  $effect(() => {
    if (isNav) return
    if (active !== undefined && !tabs.some((t) => t.id === active)) {
      active = tabs[0]?.id
    }
  })

  const activeId = $derived(isNav ? navValue : active)
</script>

<div role="tablist" class="tabs tabs-lift">
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <label class="tab gap-2">
      {#if isNav}
        <input
          type="radio"
          {name}
          value={t.id}
          bind:group={navValue}
          onchange={() => onNavSelect(t)}
          aria-label={t.label}
        />
      {:else}
        <input
          type="radio"
          {name}
          value={t.id}
          bind:group={active}
          aria-label={t.label}
        />
      {/if}
      {#if Icon}
        <Icon size={16} />
      {/if}
      <span class="whitespace-nowrap">{t.label}</span>
      {#if t.badge !== undefined}
        <span class="badge badge-sm">{t.badge}</span>
      {/if}
    </label>
    <div class="tab-content border-base-300 bg-base-100 border {contentClass}">
      {#if content && (!isNav || activeId === t.id)}
        {@render content(t.id)}
      {/if}
    </div>
  {/each}
</div>
