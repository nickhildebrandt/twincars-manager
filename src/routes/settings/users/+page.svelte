<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import { page as pageStore } from '$app/state'
  import { replaceState } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Toolbar from '$lib/components/ui/Toolbar.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import {
    Plus,
    Users,
    ShieldCheck,
    Pencil,
    Trash2,
    UserCheck,
    UserX
  } from '@lucide/svelte'
  import {
    listUsersRemote,
    listRolesRemote,
    deleteUserRemote,
    deleteRoleRemote,
    setUserActiveRemote
  } from './users.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const ADMIN_ROLE_NAME = 'Administrator'

  type Tab = 'users' | 'roles'
  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'users', label: 'Benutzer', icon: Users },
    { id: 'roles', label: 'Rollen', icon: ShieldCheck }
  ]

  /**
   * Active tab is mirrored in the URL (?tab=) so a reload returns to
   * the same panel. `replaceState` keeps the browser back-button from
   * snapping between tabs.
   */
  const initialTabFromUrl = (() => {
    const t = pageStore.url.searchParams.get('tab')
    return tabs.some((x) => x.id === t) ? (t as Tab) : 'users'
  })()
  let activeTab = $state<Tab>(initialTabFromUrl)

  $effect(() => {
    const url = new URL(pageStore.url)
    if (activeTab === 'users') url.searchParams.delete('tab')
    else url.searchParams.set('tab', activeTab)
    if (url.search !== pageStore.url.search) replaceState(url, pageStore.state)
  })

  /* — Users tab — */

  let pageNum = $state(1)
  const size = 25
  let q = $state('')

  const usersQuery = $derived(
    listUsersRemote({ page: pageNum, size, q: q || undefined })
  )

  const initialUsers = await untrack(() => usersQuery)
  let lastUsersResult = $state<typeof initialUsers>(initialUsers)
  $effect(() => {
    if (usersQuery.current) lastUsersResult = usersQuery.current
  })

  const usersResult = $derived(usersQuery.current ?? lastUsersResult)
  const users = $derived(usersResult.items)
  const usersTotal = $derived(usersResult.total)
  const usersPageCount = $derived(usersResult.pageCount)

  $effect(() => {
    if (usersQuery.error) handleClientError(usersQuery.error)
  })

  /* — Roles tab — */

  const rolesQuery = $derived(listRolesRemote())
  const initialRoles = await untrack(() => rolesQuery)
  let lastRoles = $state<typeof initialRoles>(initialRoles)
  $effect(() => {
    if (rolesQuery.current) lastRoles = rolesQuery.current
  })
  const rolesList = $derived(rolesQuery.current ?? lastRoles)

  $effect(() => {
    if (rolesQuery.error) handleClientError(rolesQuery.error)
  })

  /* — Delete dialogs (shared, dispatch by kind) — */

  let confirmOpen = $state(false)
  let confirmKind = $state<'user' | 'role'>('user')
  let toDeleteId = $state<string | null>(null)
  let toDeleteLabel = $state('')

  const askDeleteUser = (id: string, label: string) => {
    confirmKind = 'user'
    toDeleteId = id
    toDeleteLabel = label
    confirmOpen = true
  }

  const askDeleteRole = (id: string, label: string) => {
    confirmKind = 'role'
    toDeleteId = id
    toDeleteLabel = label
    confirmOpen = true
  }

  const performDelete = async () => {
    if (!toDeleteId) return
    const id = toDeleteId
    if (confirmKind === 'user') {
      try {
        await busy.run(() =>
          deleteUserRemote({ id }).updates(
            listUsersRemote({
              page: pageNum,
              size,
              q: q || undefined
            }).withOverride((current) => ({
              ...current,
              items: current.items.filter((u) => u.id !== id),
              total: Math.max(0, current.total - 1)
            }))
          )
        )
        toast.success(`Benutzer „${toDeleteLabel}" gelöscht.`)
        toDeleteId = null
      } catch (err) {
        handleClientError(err, 'Benutzer konnte nicht gelöscht werden')
      }
    } else {
      try {
        await busy.run(() =>
          deleteRoleRemote({ id }).updates(
            listRolesRemote().withOverride((current) =>
              current.filter((r) => r.id !== id)
            )
          )
        )
        toast.success(`Rolle „${toDeleteLabel}" gelöscht.`)
        toDeleteId = null
      } catch (err) {
        handleClientError(err, 'Rolle konnte nicht gelöscht werden')
      }
    }
  }

  /** Toggle a user's active flag with an optimistic list override. */
  const toggleActive = async (u: {
    id: string
    name: string
    active: boolean
  }) => {
    const next = !u.active
    try {
      await busy.run(() =>
        setUserActiveRemote({ id: u.id, active: next }).updates(
          listUsersRemote({
            page: pageNum,
            size,
            q: q || undefined
          }).withOverride((current) => ({
            ...current,
            items: current.items.map((x) =>
              x.id === u.id ? { ...x, active: next } : x
            )
          }))
        )
      )
      toast.success(
        next
          ? `Benutzer „${u.name}" aktiviert.`
          : `Benutzer „${u.name}" deaktiviert.`
      )
    } catch (err) {
      handleClientError(
        err,
        next
          ? 'Benutzer konnte nicht aktiviert werden'
          : 'Benutzer konnte nicht deaktiviert werden'
      )
    }
  }

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return '—'
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  /** Primary action mirrors the active tab. */
  const primaryAction = $derived(
    activeTab === 'users'
      ? { label: 'Neuer Benutzer', href: '/settings/users/new', icon: Plus }
      : { label: 'Neue Rolle', href: '/settings/users/roles/new', icon: Plus }
  )
</script>

<PageHeader title="Benutzer & Rollen" back="/settings" {primaryAction}>
  {#snippet toolbar()}
    {#if activeTab === 'users'}
      <Toolbar
        bind:query={q}
        placeholder="Benutzer suchen: Benutzername, Name ..."
        onQuery={() => (pageNum = 1)}
      />
    {/if}
  {/snippet}
</PageHeader>

<div role="tablist" class="tabs tabs-lift">
  {#each tabs as t (t.id)}
    {@const Icon = t.icon}
    <label class="tab gap-2">
      <input
        type="radio"
        name="users_tabs"
        bind:group={activeTab}
        value={t.id}
      />
      <Icon size={16} />
      <span>{t.label}</span>
    </label>
    <div class="tab-content border-base-300 bg-base-100 border p-0">
      {#if t.id === 'users'}
        {#if users.length === 0}
          <EmptyState
            icon={Users}
            title="Noch keine Benutzer"
            description="Legen Sie den ersten Benutzer an, um den Zugriff zu vergeben."
          >
            {#snippet action()}
              <a
                class="btn btn-primary btn-sm gap-2"
                href="/settings/users/new"
              >
                <Plus size={16} /> Neuer Benutzer
              </a>
            {/snippet}
          </EmptyState>
        {:else}
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Benutzername</th>
                  <th>Name</th>
                  <th>Rollen</th>
                  <th>Status</th>
                  <th>Erstellt</th>
                  <th class="w-40 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {#each users as u (u.id)}
                  <tr
                    class="hover:bg-base-200 cursor-pointer"
                    onclick={() => goto(`/settings/users/${u.id}/edit`)}
                  >
                    <td class="font-mono text-xs">{u.username}</td>
                    <td class="font-medium">{u.name}</td>
                    <td>
                      <div class="flex flex-wrap gap-1">
                        {#each u.roles as r (r.id)}
                          <span class="badge badge-ghost badge-sm"
                            >{r.name}</span
                          >
                        {:else}
                          <span class="text-base-content/50 text-xs">
                            keine
                          </span>
                        {/each}
                      </div>
                    </td>
                    <td>
                      {#if u.active}
                        <span class="badge badge-success badge-sm">Aktiv</span>
                      {:else}
                        <span class="badge badge-error badge-sm"
                          >Deaktiviert</span
                        >
                      {/if}
                    </td>
                    <td class="text-sm">{fmtDate(u.createdAt)}</td>
                    <td onclick={(e) => e.stopPropagation()}>
                      <div class="flex justify-end gap-1">
                        <button
                          class="btn btn-ghost btn-sm btn-square"
                          aria-label={u.active ? 'Deaktivieren' : 'Aktivieren'}
                          title={u.active ? 'Deaktivieren' : 'Aktivieren'}
                          onclick={() => toggleActive(u)}
                        >
                          {#if u.active}
                            <UserX size={16} />
                          {:else}
                            <UserCheck size={16} class="text-success" />
                          {/if}
                        </button>
                        <a
                          class="btn btn-ghost btn-sm btn-square"
                          href="/settings/users/{u.id}/edit"
                          aria-label="Bearbeiten"
                        >
                          <Pencil size={16} />
                        </a>
                        <button
                          class="btn btn-ghost btn-sm btn-square text-error"
                          aria-label="Löschen"
                          onclick={() => askDeleteUser(u.id, u.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <Pagination
            total={usersTotal}
            page={pageNum}
            pageCount={usersPageCount}
            {size}
            onPage={(p) => (pageNum = p)}
          />
        {/if}
      {:else if t.id === 'roles'}
        {#if rolesList.length === 0}
          <EmptyState
            icon={ShieldCheck}
            title="Noch keine Rollen"
            description="Legen Sie die erste Rolle an, um Berechtigungen zu bündeln."
          >
            {#snippet action()}
              <a
                class="btn btn-primary btn-sm gap-2"
                href="/settings/users/roles/new"
              >
                <Plus size={16} /> Neue Rolle
              </a>
            {/snippet}
          </EmptyState>
        {:else}
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Beschreibung</th>
                  <th>Berechtigungen</th>
                  <th class="w-32 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {#each rolesList as r (r.id)}
                  {@const isAdmin = r.name === ADMIN_ROLE_NAME}
                  {@const isWildcard = r.permissions.includes('*')}
                  <tr
                    class="hover:bg-base-200 cursor-pointer"
                    onclick={() => goto(`/settings/users/roles/${r.id}/edit`)}
                  >
                    <td class="font-medium">
                      {r.name}
                      {#if isAdmin}
                        <span class="badge badge-ghost badge-sm ml-2">
                          System
                        </span>
                      {/if}
                    </td>
                    <td class="text-base-content/70 text-sm">
                      {r.description ?? '—'}
                    </td>
                    <td>
                      <div class="flex flex-wrap items-center gap-1">
                        {#if isWildcard}
                          <span class="badge badge-primary badge-sm">
                            Voller Zugriff (*)
                          </span>
                        {:else}
                          {#each r.permissions.slice(0, 3) as p (p)}
                            <span class="badge badge-ghost badge-sm font-mono">
                              {p}
                            </span>
                          {/each}
                          {#if r.permissions.length > 3}
                            <span class="text-base-content/60 text-xs">
                              +{r.permissions.length - 3}
                            </span>
                          {/if}
                          {#if r.permissions.length === 0}
                            <span class="text-base-content/50 text-xs">
                              keine
                            </span>
                          {/if}
                        {/if}
                      </div>
                    </td>
                    <td onclick={(e) => e.stopPropagation()}>
                      <div class="flex justify-end gap-1">
                        <a
                          class="btn btn-ghost btn-sm btn-square"
                          href="/settings/users/roles/{r.id}/edit"
                          aria-label="Bearbeiten"
                        >
                          <Pencil size={16} />
                        </a>
                        <button
                          class="btn btn-ghost btn-sm btn-square text-error"
                          aria-label="Löschen"
                          disabled={isAdmin}
                          onclick={() => askDeleteRole(r.id, r.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>
  {/each}
</div>

<ConfirmDialog
  bind:open={confirmOpen}
  title={confirmKind === 'user' ? 'Benutzer löschen?' : 'Rolle löschen?'}
  message={confirmKind === 'user'
    ? `Soll der Benutzer „${toDeleteLabel}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`
    : `Soll die Rolle „${toDeleteLabel}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmOpen = false)}
/>
