<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import {
    ArrowLeft,
    ArrowRight,
    Pencil,
    Receipt,
    RotateCcw,
    Trash2
  } from '@lucide/svelte'
  import {
    addWorkOrderItemRemote,
    completeWorkOrderRemote,
    deleteWorkOrderItemRemote,
    deleteWorkOrderRemote,
    getLaborRateRemote,
    getWorkOrderRemote,
    moveWorkOrderStatusRemote,
    updateWorkOrderItemRemote
  } from '../orders.remote'
  import { pickEmployeesRemote, pickItemsRemote } from '../../pickers.remote'
  import { PAYMENT_METHODS, type PaymentMethod } from '$lib/payment-methods'
  import { formatEuro } from '$lib/utils/money'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await for SSR; `detail` stays reactive to `query.current`
   * so single-flight item / status mutations update the view. The labor
   * rate and the employee roster (small shop, ≤ 100 — used to resolve
   * per-item employee names and to feed the picker) load in parallel.
   */
  const query = getWorkOrderRemote({ id })
  const [initial, laborRate, employeesPage] = await Promise.all([
    query,
    getLaborRateRemote(),
    pickEmployeesRemote({ page: 1, size: 100 })
  ])
  const detail = $derived(query.current ?? initial)
  const order = $derived(detail.order)
  const items = $derived(detail.items)

  const employeeLabelById = new Map(
    employeesPage.items.map((e) => [e.id, e.label])
  )

  const isDone = $derived(order.status === 'done')
  const hasInvoice = $derived(order.invoiceId !== null)

  const statusLabels: Record<string, string> = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    done: 'Abgeschlossen'
  }
  const statusBadges: Record<string, string> = {
    open: 'badge-ghost',
    in_progress: 'badge-info',
    done: 'badge-success'
  }

  const todayIso = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const fmtDateTime = (d: Date | string | null): string =>
    d
      ? new Intl.DateTimeFormat('de-DE', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }).format(new Date(d))
      : '-'

  const fmtDate = (d: string | null): string =>
    d
      ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(
          new Date(d)
        )
      : '-'

  const fmtAmount = (v: string | number | null): string =>
    Number(v ?? 0).toLocaleString('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3
    })

  const rowTotal = (it: (typeof items)[number]): number =>
    Number(it.quantity) * Number(it.unitPriceNet)

  const netTotal = $derived(items.reduce((sum, it) => sum + rowTotal(it), 0))

  /* ── Status transitions ────────────────────────────────────────── */

  const setStatus = async (status: 'open' | 'in_progress') => {
    try {
      await busy.run(() =>
        moveWorkOrderStatusRemote({ id, status }).updates(
          getWorkOrderRemote({ id }).withOverride((current) => ({
            ...current,
            order: { ...current.order, status }
          }))
        )
      )
    } catch (err) {
      handleClientError(err, 'Status konnte nicht geändert werden')
    }
  }

  /* ── Delete order (only while no invoice exists — GoBD) ─────────── */

  let deleteOrderOpen = $state(false)

  const removeOrder = async () => {
    try {
      await busy.run(() => deleteWorkOrderRemote({ id }))
      toast.success('Auftrag gelöscht.')
      goto('/orders', { replaceState: true })
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht gelöscht werden')
    }
  }

  /* ── Work-item add / edit form ─────────────────────────────────── */

  const laborRateValue = laborRate ? Number(laborRate.unitPriceNet ?? 0) : 0
  const laborRateMissing = laborRateValue <= 0

  let editingItemId = $state<string | null>(null)
  let itemKind = $state<'labor' | 'material'>('labor')
  let catalogItemId = $state('')
  let catalogItemLabel = $state('')
  let itemDescription = $state('')
  let itemEmployeeId = $state('')
  let itemEmployeeLabel = $state('')
  let itemHours = $state('')
  let itemQuantity = $state('1')
  let itemUnit = $state('Stk')
  let itemPrice = $state(laborRateValue > 0 ? String(laborRateValue) : '')
  let itemDoneAt = $state(todayIso())
  let itemError = $state<string | null>(null)

  const resetItemForm = () => {
    editingItemId = null
    catalogItemId = ''
    catalogItemLabel = ''
    itemDescription = ''
    itemEmployeeId = ''
    itemEmployeeLabel = ''
    itemHours = ''
    itemQuantity = '1'
    itemUnit = 'Stk'
    itemPrice =
      itemKind === 'labor' && laborRateValue > 0 ? String(laborRateValue) : ''
    itemDoneAt = todayIso()
    itemError = null
  }

  /** Kind switch clears the catalog pick and re-prefills the price
   * (labor: current workshop rate; material: empty until picked). */
  const switchKind = (kind: 'labor' | 'material') => {
    if (itemKind === kind) return
    itemKind = kind
    catalogItemId = ''
    catalogItemLabel = ''
    itemPrice =
      kind === 'labor' && laborRateValue > 0 ? String(laborRateValue) : ''
    if (kind === 'material') itemUnit = 'Stk'
  }

  const searchEmployees = (params: { q: string; page: number; size: number }) =>
    pickEmployeesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  // The catalog picker follows the kind toggle: Arbeitszeit searches
  // Leistungen (services), Material searches Artikel/Material.
  const searchCatalogItems = (params: {
    q: string
    page: number
    size: number
  }) =>
    pickItemsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100,
      category: itemKind === 'labor' ? 'services' : 'articles'
    }).run()

  type CatalogHit = {
    id: string
    label: string
    description: string
    unit: string
    unitPriceNet: number
  }

  const onCatalogSelect = (item: CatalogHit | null) => {
    if (!item) {
      catalogItemId = ''
      catalogItemLabel = ''
      return
    }
    itemDescription = item.description
    itemPrice = String(item.unitPriceNet)
    if (itemKind === 'material') itemUnit = item.unit
  }

  const startEditItem = (it: (typeof items)[number]) => {
    editingItemId = it.id
    itemKind = it.kind as 'labor' | 'material'
    catalogItemId = it.itemId ?? ''
    catalogItemLabel = it.itemId ? it.description : ''
    itemDescription = it.description
    itemEmployeeId = it.employeeId ?? ''
    itemEmployeeLabel = it.employeeId
      ? (employeeLabelById.get(it.employeeId) ?? '')
      : ''
    itemHours = it.hours != null ? String(Number(it.hours)) : ''
    itemQuantity = String(Number(it.quantity))
    itemUnit = it.unit ?? 'Stk'
    itemPrice = String(Number(it.unitPriceNet))
    itemDoneAt = it.doneAt
    itemError = null
  }

  const submitItem = async (e: Event) => {
    e.preventDefault()
    itemError = null
    const description = itemDescription.trim()
    if (!description) {
      itemError = 'Bitte eine Beschreibung eingeben.'
      return
    }
    const price = Number(itemPrice)
    if (!Number.isFinite(price)) {
      itemError = 'Bitte einen gültigen Preis eingeben.'
      return
    }
    let hours: number | null = null
    let quantity: number | undefined
    if (itemKind === 'labor') {
      hours = Number(itemHours)
      if (!Number.isFinite(hours) || hours <= 0) {
        itemError = 'Bitte eine positive Stundenzahl eingeben.'
        return
      }
    } else {
      quantity = Number(itemQuantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        itemError = 'Bitte eine positive Menge eingeben.'
        return
      }
    }
    const values = {
      kind: itemKind,
      itemId: catalogItemId || null,
      description,
      quantity,
      unit: itemKind === 'labor' ? 'Std.' : itemUnit.trim() || undefined,
      unitPriceNet: price,
      employeeId: itemEmployeeId || null,
      hours,
      doneAt: itemDoneAt
    }
    try {
      const editingId = editingItemId
      await busy.run(() =>
        (editingId
          ? updateWorkOrderItemRemote({ id: editingId, values })
          : addWorkOrderItemRemote({ workOrderId: id, values })
        ).updates(getWorkOrderRemote({ id }))
      )
      toast.success(
        editingId ? 'Position gespeichert.' : 'Position hinzugefügt.'
      )
      resetItemForm()
    } catch (err) {
      handleClientError(err, 'Position konnte nicht gespeichert werden')
    }
  }

  let deleteItemId = $state<string | null>(null)
  let deleteItemOpen = $state(false)

  const askDeleteItem = (itemId: string) => {
    deleteItemId = itemId
    deleteItemOpen = true
  }

  const performDeleteItem = async () => {
    if (!deleteItemId) return
    const itemId = deleteItemId
    try {
      // Optimistic: the row vanishes immediately, the same flight
      // carries the authoritative detail refresh.
      await busy.run(() =>
        deleteWorkOrderItemRemote({ id: itemId, workOrderId: id }).updates(
          getWorkOrderRemote({ id }).withOverride((current) => ({
            ...current,
            items: current.items.filter((it) => it.id !== itemId)
          }))
        )
      )
      if (editingItemId === itemId) resetItemForm()
      toast.success('Position gelöscht.')
    } catch (err) {
      handleClientError(err, 'Position konnte nicht gelöscht werden')
    } finally {
      deleteItemId = null
    }
  }

  /* ── Completion → invoice ──────────────────────────────────────── */

  let completeOpen = $state(false)
  let issueDate = $state(todayIso())
  let paymentMethod = $state<'' | PaymentMethod>('')

  const openCompleteDialog = () => {
    issueDate = todayIso()
    paymentMethod = ''
    completeOpen = true
  }

  const complete = async () => {
    try {
      const result = await busy.run(() =>
        completeWorkOrderRemote({
          id,
          issueDate,
          paymentMethod: paymentMethod || undefined
        })
      )
      completeOpen = false
      toast.success(`Rechnung ${result.invoiceNumber} erstellt.`)
      goto(`/invoices/${result.invoiceId}`)
    } catch (err) {
      handleClientError(err, 'Auftrag konnte nicht abgeschlossen werden')
    }
  }
</script>

<PageHeader
  title={`${order.orderNumber} · ${order.title}`}
  back="/orders"
  primaryAction={isDone
    ? undefined
    : { label: 'Bearbeiten', href: `/orders/${order.id}/edit`, icon: Pencil }}
/>

<div class="mb-4 flex flex-wrap items-center gap-2">
  <span class="badge {statusBadges[order.status] ?? 'badge-ghost'}">
    {statusLabels[order.status] ?? order.status}
  </span>
  {#if order.status === 'open'}
    <button
      type="button"
      class="btn btn-sm gap-2"
      onclick={() => setStatus('in_progress')}
      disabled={busy.active}
    >
      <ArrowRight size={14} />
      In Bearbeitung
    </button>
  {:else if order.status === 'in_progress'}
    <button
      type="button"
      class="btn btn-sm gap-2"
      onclick={() => setStatus('open')}
      disabled={busy.active}
    >
      <ArrowLeft size={14} />
      Zurück zu Offen
    </button>
  {:else if isDone && !hasInvoice}
    <!-- Reopening is only possible while no invoice exists (service rule). -->
    <button
      type="button"
      class="btn btn-sm gap-2"
      onclick={() => setStatus('in_progress')}
      disabled={busy.active}
    >
      <RotateCcw size={14} />
      Wieder öffnen
    </button>
  {/if}
  {#if !hasInvoice}
    <button
      type="button"
      class="btn btn-ghost btn-sm text-error gap-2"
      onclick={() => (deleteOrderOpen = true)}
      disabled={busy.active}
    >
      <Trash2 size={14} />
      Löschen
    </button>
  {/if}
</div>

{#if isDone && order.invoiceId}
  <div class="alert alert-success mb-4">
    <Receipt size={18} />
    <span>
      Dieser Auftrag ist abgeschlossen und abgerechnet:
      <a href={`/invoices/${order.invoiceId}`} class="link font-medium">
        Rechnung {detail.invoiceNumber ?? ''}
      </a>
    </span>
  </div>
{/if}

<div class="grid grid-cols-1 gap-4">
  <!-- Stammdaten -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body">
      <h3 class="card-title text-base">Stammdaten</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-4">
        <dt class="text-base-content/60">Kunde</dt>
        <dd class="sm:col-span-3">
          {#if order.customerId}
            <a href={`/customers/${order.customerId}`} class="link">
              {detail.customerLabel ?? '-'}
            </a>
          {:else}
            -
          {/if}
        </dd>
        <dt class="text-base-content/60">Fahrzeug</dt>
        <dd class="sm:col-span-3">
          {#if order.vehicleId}
            <a href={`/vehicles/${order.vehicleId}`} class="link">
              {detail.vehicleLabel ?? '-'}
            </a>
          {:else}
            -
          {/if}
        </dd>
        {#if order.appointmentId}
          <dt class="text-base-content/60">Termin</dt>
          <dd class="sm:col-span-3">
            <a href={`/calendar/${order.appointmentId}/edit`} class="link">
              {detail.appointmentTitle ?? 'Zum Termin'}
            </a>
          </dd>
        {/if}
        <dt class="text-base-content/60">Geplant am</dt>
        <dd class="sm:col-span-3">{fmtDateTime(order.scheduledAt)}</dd>
        <dt class="text-base-content/60">Mitarbeiter</dt>
        <dd class="sm:col-span-3">
          {#if detail.assignees.length > 0}
            <span class="flex flex-wrap gap-1">
              {#each detail.assignees as assignee (assignee.id)}
                <span class="badge badge-ghost badge-sm">
                  {assignee.label}
                </span>
              {/each}
            </span>
          {:else}
            -
          {/if}
        </dd>
        {#if isDone}
          <dt class="text-base-content/60">Abgeschlossen am</dt>
          <dd class="sm:col-span-3">{fmtDateTime(order.completedAt)}</dd>
        {/if}
        {#if order.description}
          <dt class="text-base-content/60">Beschreibung</dt>
          <dd class="whitespace-pre-line sm:col-span-3">
            {order.description}
          </dd>
        {/if}
      </dl>
    </div>
  </div>

  <!-- Positionen -->
  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body p-0">
      <div class="border-base-300 border-b px-4 py-3">
        <h3 class="text-base font-semibold">Positionen</h3>
        <p class="text-base-content/60 text-sm">
          Arbeitszeiten und Material dieses Auftrags.
          {#if isDone}
            Der Auftrag ist abgeschlossen, die Positionen sind schreibgeschützt.
          {/if}
        </p>
      </div>

      {#if items.length === 0}
        <div class="text-base-content/60 px-4 py-6 text-sm">
          Noch keine Positionen erfasst.
        </div>
      {:else}
        <!-- Desktop / tablet: full table. Hidden below `lg`. -->
        <div class="hidden overflow-x-auto lg:block">
          <table class="table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Beschreibung</th>
                <th>Mitarbeiter</th>
                <th class="text-right">Std. / Menge</th>
                <th class="text-right">Einzelpreis</th>
                <th class="text-right">Summe</th>
                {#if !isDone}
                  <th class="text-right">Aktionen</th>
                {/if}
              </tr>
            </thead>
            <tbody>
              {#each items as it (it.id)}
                <tr>
                  <td class="font-mono text-xs">{it.position}</td>
                  <td>
                    <span class="break-words">{it.description}</span>
                    <span class="text-base-content/60 block text-xs">
                      {it.kind === 'labor' ? 'Arbeitszeit' : 'Material'}
                      · {fmtDate(it.doneAt)}
                    </span>
                  </td>
                  <td>
                    {it.employeeId
                      ? (employeeLabelById.get(it.employeeId) ?? '-')
                      : '-'}
                  </td>
                  <td class="text-right font-mono">
                    {#if it.kind === 'labor'}
                      {fmtAmount(it.hours ?? it.quantity)} Std.
                    {:else}
                      {fmtAmount(it.quantity)}
                      {it.unit ?? 'Stk'}
                    {/if}
                  </td>
                  <td class="text-right font-mono">
                    {formatEuro(Number(it.unitPriceNet))}
                  </td>
                  <td class="text-right font-mono">
                    {formatEuro(rowTotal(it))}
                  </td>
                  {#if !isDone}
                    <td class="text-right" onclick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        title="Position bearbeiten"
                        aria-label="Position bearbeiten"
                        onclick={() => startEditItem(it)}
                        disabled={busy.active}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs text-error"
                        title="Position löschen"
                        aria-label="Position löschen"
                        onclick={() => askDeleteItem(it.id)}
                        disabled={busy.active}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="bg-base-200/30 border-t-2 font-semibold">
                <td colspan="5" class="text-right"> Summe (netto) </td>
                <td class="text-right font-mono">{formatEuro(netTotal)}</td>
                {#if !isDone}
                  <td></td>
                {/if}
              </tr>
            </tfoot>
          </table>
        </div>
        <!-- Phone / small tablet: stacked list of the same positions. -->
        <ul class="divide-base-300 divide-y lg:hidden">
          {#each items as it (it.id)}
            <li class="flex items-start gap-2 px-4 py-3">
              <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="text-sm font-medium break-words">
                  {it.description}
                </span>
                <span class="text-base-content/60 text-xs">
                  {it.kind === 'labor' ? 'Arbeitszeit' : 'Material'}
                  · {fmtDate(it.doneAt)}
                </span>
                <span class="font-mono text-xs">
                  {#if it.kind === 'labor'}
                    {fmtAmount(it.hours ?? it.quantity)} Std. x {formatEuro(
                      Number(it.unitPriceNet)
                    )} = {formatEuro(rowTotal(it))}
                  {:else}
                    {fmtAmount(it.quantity)}
                    {it.unit ?? 'Stk'} x {formatEuro(Number(it.unitPriceNet))} =
                    {formatEuro(rowTotal(it))}
                  {/if}
                </span>
                {#if it.employeeId}
                  <span class="text-base-content/70 text-xs">
                    {employeeLabelById.get(it.employeeId) ?? '-'}
                  </span>
                {/if}
              </div>
              {#if !isDone}
                <div class="flex shrink-0 gap-1">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    title="Position bearbeiten"
                    aria-label="Position bearbeiten"
                    onclick={() => startEditItem(it)}
                    disabled={busy.active}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    title="Position löschen"
                    aria-label="Position löschen"
                    onclick={() => askDeleteItem(it.id)}
                    disabled={busy.active}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              {/if}
            </li>
          {/each}
          <li
            class="flex items-center justify-end gap-3 px-4 py-3 font-semibold"
          >
            <span class="text-sm">Summe (netto)</span>
            <span class="font-mono text-sm">{formatEuro(netTotal)}</span>
          </li>
        </ul>
      {/if}

      {#if !isDone}
        <form
          onsubmit={submitItem}
          class="border-base-300 flex flex-col gap-3 border-t px-4 py-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-sm font-semibold">
              {editingItemId ? 'Position bearbeiten' : 'Neue Position erfassen'}
            </h4>
            <div class="join">
              <input
                type="radio"
                name="item-kind"
                class="join-item btn btn-sm"
                aria-label="Arbeitszeit"
                checked={itemKind === 'labor'}
                onchange={() => switchKind('labor')}
              />
              <input
                type="radio"
                name="item-kind"
                class="join-item btn btn-sm"
                aria-label="Material"
                checked={itemKind === 'material'}
                onchange={() => switchKind('material')}
              />
            </div>
          </div>

          {#if itemError}
            <div class="alert alert-error">
              <span>{itemError}</span>
            </div>
          {/if}

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="flex w-full flex-col gap-1">
              <span class="label-text">
                {itemKind === 'labor'
                  ? 'Leistung aus Katalog (optional)'
                  : 'Artikel aus Katalog (optional)'}
              </span>
              <SearchablePicker
                bind:value={catalogItemId}
                bind:valueLabel={catalogItemLabel}
                dialogTitle={itemKind === 'labor'
                  ? 'Leistung auswählen'
                  : 'Artikel auswählen'}
                placeholder="Katalog durchsuchen oder Freitext nutzen"
                search={searchCatalogItems}
                onSelect={onCatalogSelect}
              />
            </div>
            <label class="flex w-full flex-col gap-1 lg:col-span-2">
              <span class="label-text">Beschreibung *</span>
              <input
                class="input input-bordered w-full"
                maxlength="500"
                placeholder="z. B. Bremsbeläge vorn erneuert"
                bind:value={itemDescription}
              />
            </label>
            <div class="flex w-full flex-col gap-1">
              <span class="label-text">Mitarbeiter</span>
              <SearchablePicker
                bind:value={itemEmployeeId}
                bind:valueLabel={itemEmployeeLabel}
                dialogTitle="Mitarbeiter auswählen"
                search={searchEmployees}
                onSelect={() => {}}
              />
            </div>
            {#if itemKind === 'labor'}
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Stunden *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0.25"
                  step="0.25"
                  bind:value={itemHours}
                />
              </label>
            {:else}
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Menge *</span>
                <input
                  class="input input-bordered w-full"
                  type="number"
                  min="0.001"
                  step="any"
                  bind:value={itemQuantity}
                />
              </label>
            {/if}
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">
                {itemKind === 'labor'
                  ? 'Stundensatz (netto) *'
                  : 'Einzelpreis (netto) *'}
              </span>
              <input
                class="input input-bordered w-full"
                type="number"
                step="0.01"
                bind:value={itemPrice}
              />
              {#if itemKind === 'labor' && laborRateMissing}
                <span class="text-base-content/60 text-xs">
                  Kein Stundensatz hinterlegt. Stundensatz in den Einstellungen
                  pflegen.
                </span>
              {/if}
            </label>
            {#if itemKind === 'material'}
              <label class="flex w-full flex-col gap-1">
                <span class="label-text">Einheit</span>
                <input
                  class="input input-bordered w-full"
                  maxlength="20"
                  bind:value={itemUnit}
                />
              </label>
            {/if}
            <label class="flex w-full flex-col gap-1">
              <span class="label-text">Erledigt am *</span>
              <input
                class="input input-bordered w-full"
                type="date"
                bind:value={itemDoneAt}
              />
            </label>
          </div>

          <div class="flex justify-end gap-2">
            {#if editingItemId}
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onclick={resetItemForm}
                disabled={busy.active}
              >
                Abbrechen
              </button>
            {/if}
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              disabled={busy.active}
            >
              {#if busy.active}
                <span class="loading loading-spinner loading-sm"></span>
              {/if}
              {editingItemId ? 'Position speichern' : 'Position hinzufügen'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>

  <!-- Abschluss -->
  {#if !isDone}
    <div class="card border-base-300 bg-base-100 border">
      <div class="card-body">
        <h3 class="card-title text-base">Abschluss</h3>
        <p class="text-base-content/60 text-sm">
          Erstellt aus allen erfassten Positionen automatisch die Rechnung und
          schließt den Auftrag ab.
        </p>
        <div class="card-actions items-center justify-end gap-2">
          {#if items.length === 0}
            <span class="text-base-content/60 text-xs">
              Mindestens eine Position erforderlich.
            </span>
          {/if}
          <button
            type="button"
            class="btn btn-primary"
            onclick={openCompleteDialog}
            disabled={busy.active || items.length === 0}
          >
            <Receipt size={16} />
            Abschließen &amp; Rechnung erstellen
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if completeOpen}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-semibold">Auftrag abschließen?</h3>
      <p class="text-base-content/80 py-3 text-sm">
        Aus den {items.length}
        {items.length === 1 ? 'Position' : 'Positionen'} wird die Rechnung erstellt.
        Der Auftrag wird danach schreibgeschützt.
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Rechnungsdatum *</span>
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={issueDate}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Zahlungsart</span>
          <select
            class="select select-bordered w-full"
            bind:value={paymentMethod}
          >
            <option value="">-</option>
            {#each PAYMENT_METHODS as method (method)}
              <option value={method}>{method}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={() => (completeOpen = false)}
          disabled={busy.active}
        >
          Abbrechen
        </button>
        <button
          type="button"
          class="btn btn-primary"
          onclick={complete}
          disabled={busy.active || !issueDate}
        >
          {#if busy.active}
            <span class="loading loading-spinner loading-sm"></span>
          {/if}
          Abschließen &amp; Rechnung erstellen
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={() => (completeOpen = false)}
    ></button>
  </dialog>
{/if}

<ConfirmDialog
  bind:open={deleteOrderOpen}
  title="Auftrag löschen?"
  message={`Der Auftrag ${order.orderNumber} wird unwiderruflich gelöscht. Erfasste Arbeitszeiten dieses Auftrags werden ebenfalls entfernt.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={removeOrder}
  onClose={() => {}}
/>

<ConfirmDialog
  bind:open={deleteItemOpen}
  title="Position löschen?"
  message="Die Position wird entfernt. Eine daraus erfasste Arbeitszeit wird ebenfalls gelöscht."
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDeleteItem}
  onClose={() => (deleteItemId = null)}
/>
