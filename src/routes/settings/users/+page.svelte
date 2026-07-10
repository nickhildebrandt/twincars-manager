<script lang="ts">
  /**
   * Benutzer & Rollen — one page with two stacked sections (users on
   * top, roles below). The former inner users/roles tabs were
   * flattened: the settings area has exactly ONE tab level (the
   * section layout) and no tabs inside a settings tab.
   */
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
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

  /* — Users section — */

  let pageNum = $state(1)
  const size = 25 as const
  let q = $state('')

  // Only set filter keys carry into the arg object — the cache key of
  // the mutation-side instance must match this one exactly.
  const usersArgs = $derived({ page: pageNum, size, ...(q ? { q } : {}) })

  const initialUsers = await untrack(() => listUsersRemote(usersArgs))
  let lastUsersResult = $state<typeof initialUsers>(initialUsers)

  // Re-called on EVERY read (never memoized): a memoized remote proxy
  // holds a dead cache entry after init — `current` stays undefined and
  // optimistic overrides never render. See src/routes/orders/+page.svelte.
  const usersResult = $derived.by(
    () => listUsersRemote(usersArgs).current ?? lastUsersResult
  )
  const users = $derived(usersResult.items)
  const usersTotal = $derived(usersResult.total)
  const usersPageCount = $derived(usersResult.pageCount)

  $effect(() => {
    const usersQuery = listUsersRemote(usersArgs)
    if (usersQuery.current) lastUsersResult = usersQuery.current
    if (usersQuery.error) handleClientError(usersQuery.error)
  })

  /* — Roles section — */

  const initialRoles = await untrack(() => listRolesRemote())
  let lastRoles = $state<typeof initialRoles>(initialRoles)
  const rolesList = $derived.by(() => listRolesRemote().current ?? lastRoles)

  $effect(() => {
    const rolesQuery = listRolesRemote()
    if (rolesQuery.current) lastRoles = rolesQuery.current
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
            listUsersRemote(usersArgs).withOverride((current) => ({
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
          listUsersRemote(usersArgs).withOverride((current) => ({
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
    if (!d) return '-'
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }
</script>

<PageHeader
  title="Benutzer & Rollen"
  back="/settings"
  primaryAction={{
    label: 'Neuer Benutzer',
    href: '/settings/users/new',
    icon: Plus
  }}
>
  {#snippet toolbar()}
    <Toolbar
      bind:query={q}
      placeholder="Benutzer suchen: Benutzername, Name ..."
      onQuery={() => (pageNum = 1)}
    />
  {/snippet}
</PageHeader>

<div class="flex flex-col gap-4">
  <!-- Users section -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body p-0">
      <div
        class="border-base-300 flex items-center justify-between border-b px-4 py-3"
      >
        <h3 class="text-base font-semibold">
          <Users size={18} class="text-base-content/60 mr-1 inline" />
          Benutzer
        </h3>
        <span class="text-base-content/60 text-sm">
          {usersTotal}
          {usersTotal === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>
      {#if users.length === 0}
        <EmptyState
          icon={Users}
          title="Noch keine Benutzer"
          description="Legen Sie den ersten Benutzer an, um den Zugriff zu vergeben."
        >
          {#snippet action()}
            <a class="btn btn-primary btn-sm gap-2" href="/settings/users/new">
              <Plus size={16} /> Neuer Benutzer
            </a>
          {/snippet}
        </EmptyState>
      {:else}
        <!-- Desktop / tablet: full table. Hidden below `lg`. -->
        <div class="hidden overflow-x-auto lg:block">
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
                        <span class="badge badge-ghost badge-sm">{r.name}</span>
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
                      <span class="badge badge-error badge-sm">Deaktiviert</span
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
        <!-- Phone / small tablet: stacked card list with the essentials. -->
        <ul class="divide-base-300 divide-y lg:hidden">
          {#each users as u (u.id)}
            <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
              <a
                href={`/settings/users/${u.id}/edit`}
                class="flex min-w-0 flex-1 flex-col gap-0.5"
              >
                <span class="truncate text-sm font-medium">{u.name}</span>
                <span class="text-base-content/60 truncate font-mono text-xs">
                  {u.username}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-1">
                  {#each u.roles as r (r.id)}
                    <span class="badge badge-ghost badge-sm">{r.name}</span>
                  {:else}
                    <span class="text-base-content/50 text-xs">keine</span>
                  {/each}
                  {#if u.active}
                    <span class="badge badge-success badge-sm">Aktiv</span>
                  {:else}
                    <span class="badge badge-error badge-sm">
                      Deaktiviert
                    </span>
                  {/if}
                </span>
              </a>
              <div class="flex shrink-0 items-start gap-1">
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
            </li>
          {/each}
        </ul>
        <Pagination
          total={usersTotal}
          page={pageNum}
          pageCount={usersPageCount}
          {size}
          onPage={(p) => (pageNum = p)}
        />
      {/if}
    </div>
  </div>

  <!-- Roles section -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body p-0">
      <div
        class="border-base-300 flex items-center justify-between border-b px-4 py-3"
      >
        <h3 class="text-base font-semibold">
          <ShieldCheck size={18} class="text-base-content/60 mr-1 inline" />
          Rollen
        </h3>
        <a
          class="btn btn-primary btn-sm gap-2"
          href="/settings/users/roles/new"
        >
          <Plus size={16} /> Neue Rolle
        </a>
      </div>
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
        <!-- Desktop / tablet: full table. Hidden below `lg`. -->
        <div class="hidden overflow-x-auto lg:block">
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
                    {r.description ?? '-'}
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
        <!-- Phone / small tablet: stacked card list with the essentials. -->
        <ul class="divide-base-300 divide-y lg:hidden">
          {#each rolesList as r (r.id)}
            {@const isAdmin = r.name === ADMIN_ROLE_NAME}
            {@const isWildcard = r.permissions.includes('*')}
            <li class="hover:bg-base-200 flex items-stretch gap-2 p-3">
              <a
                href={`/settings/users/roles/${r.id}/edit`}
                class="flex min-w-0 flex-1 flex-col gap-0.5"
              >
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium">{r.name}</span>
                  {#if isAdmin}
                    <span class="badge badge-ghost badge-sm shrink-0">
                      System
                    </span>
                  {/if}
                </span>
                <span class="mt-0.5 flex items-center gap-1">
                  {#if isWildcard}
                    <span class="badge badge-primary badge-sm">
                      Voller Zugriff (*)
                    </span>
                  {:else}
                    <span class="text-base-content/70 text-xs">
                      {r.permissions.length}
                      {r.permissions.length === 1
                        ? 'Berechtigung'
                        : 'Berechtigungen'}
                    </span>
                  {/if}
                </span>
              </a>
              <div class="flex shrink-0 items-start gap-1">
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
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
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
