<script lang="ts">
  /**
   * Settings section layout: the ONE tab level across all settings
   * areas (standard TabGroup in navigation mode) — including mail
   * templates, payment reminders, SMTP, the KFZ-Kaufmann import and
   * the eBay connection, which live here as tabs by design. Tabs are
   * filtered by the caller's module permissions (mirroring the
   * sidebar's permission filter); "Konto" is self-service and always
   * visible. No settings page may render another tab level inside its
   * panel.
   */
  import { page } from '$app/state'
  import TabGroup, { type TabItem } from '$lib/components/ui/TabGroup.svelte'
  import { getCurrentUserRemote } from '../layout.remote'

  const { children } = $props()

  const user = await getCurrentUserRemote()
  const permissions = new Set(user?.permissions ?? [])
  const can = (key: string | null): boolean =>
    key === null || permissions.has('*') || permissions.has(key)

  type SettingsTab = TabItem & { permission: string | null }

  const tabs: SettingsTab[] = [
    {
      id: 'general',
      label: 'Allgemein',
      href: '/settings',
      permission: 'settings',
      exact: true
    },
    {
      id: 'mail',
      label: 'Mailvorlagen',
      href: '/settings/mail',
      permission: 'settings'
    },
    {
      id: 'reminders',
      label: 'Zahlungserinnerung',
      href: '/settings/reminders',
      permission: 'settings'
    },
    {
      id: 'smtp',
      label: 'SMTP',
      href: '/settings/smtp',
      permission: 'settings'
    },
    {
      id: 'users',
      label: 'Benutzer & Rollen',
      href: '/settings/users',
      permission: 'users'
    },
    {
      id: 'workshop-hours',
      label: 'Öffnungszeiten',
      href: '/settings/workshop-hours',
      permission: 'settings'
    },
    {
      id: 'tire-reminders',
      label: 'Reifen-Erinnerungen',
      href: '/settings/tire-reminders',
      permission: 'settings'
    },
    {
      id: 'inquiries',
      label: 'Anfragen',
      href: '/settings/inquiries',
      permission: 'mailings'
    },
    {
      id: 'ebay',
      label: 'eBay',
      href: '/settings/ebay',
      permission: 'settings'
    },
    {
      id: 'import',
      label: 'Import',
      href: '/settings/import',
      permission: 'import'
    },
    {
      id: 'account',
      label: 'Konto',
      href: '/settings/account',
      permission: null
    }
  ]
  const visibleTabs = tabs.filter((t) => can(t.permission))

  /**
   * A tab must match the current route, otherwise TabGroup would show
   * no panel at all (e.g. a route the caller has no tab for) — then we
   * render the children bare instead.
   */
  const hasActiveTab = $derived(
    visibleTabs.some((t) => {
      const p = page.url.pathname
      if (t.exact) return p === t.href
      return p === t.href || p.startsWith(t.href + '/')
    })
  )
</script>

{#if visibleTabs.length > 1 && hasActiveTab}
  <TabGroup name="settings_nav_tabs" tabs={visibleTabs}>
    {#snippet content()}
      {@render children?.()}
    {/snippet}
  </TabGroup>
{:else}
  {@render children?.()}
{/if}
