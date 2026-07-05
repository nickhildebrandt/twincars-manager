<script lang="ts">
  /**
   * Settings section layout: one tab bar across all settings areas —
   * including the KFZ-Kaufmann import and the eBay connection, which
   * live here as tabs by design. Tabs are filtered by the caller's
   * module permissions (mirroring the sidebar's permission filter);
   * "Konto" is self-service and always visible.
   */
  import { page } from '$app/state'
  import { getCurrentUserRemote } from '../layout.remote'

  const { children } = $props()

  const user = await getCurrentUserRemote()
  const permissions = new Set(user?.permissions ?? [])
  const can = (key: string | null): boolean =>
    key === null || permissions.has('*') || permissions.has(key)

  type Tab = {
    label: string
    href: string
    permission: string | null
    exact?: boolean
  }

  const tabs: Tab[] = [
    {
      label: 'Allgemein',
      href: '/settings',
      permission: 'settings',
      exact: true
    },
    {
      label: 'Benutzer & Rollen',
      href: '/settings/users',
      permission: 'users'
    },
    {
      label: 'Öffnungszeiten',
      href: '/settings/workshop-hours',
      permission: 'settings'
    },
    {
      label: 'Reifen-Erinnerungen',
      href: '/settings/tire-reminders',
      permission: 'settings'
    },
    { label: 'Anfragen', href: '/settings/inquiries', permission: 'mailings' },
    { label: 'eBay', href: '/settings/ebay', permission: 'settings' },
    { label: 'Import', href: '/settings/import', permission: 'import' },
    { label: 'Konto', href: '/settings/account', permission: null }
  ]
  const visibleTabs = tabs.filter((t) => can(t.permission))

  const isActive = (tab: Tab): boolean => {
    const p = page.url.pathname
    if (tab.exact) return p === tab.href
    return p === tab.href || p.startsWith(tab.href + '/')
  }
</script>

{#if visibleTabs.length > 1}
  <div class="mb-4 overflow-x-auto">
    <div role="tablist" class="tabs tabs-box w-max">
      {#each visibleTabs as tab (tab.href)}
        <a
          role="tab"
          href={tab.href}
          class="tab whitespace-nowrap"
          class:tab-active={isActive(tab)}
        >
          {tab.label}
        </a>
      {/each}
    </div>
  </div>
{/if}

{@render children?.()}
