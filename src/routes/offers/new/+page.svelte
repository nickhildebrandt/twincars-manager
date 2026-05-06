<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { createOfferRemote } from '../offers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { Plus, Trash2 } from '@lucide/svelte'
  import {
    pickCustomersRemote,
    pickVehiclesRemote,
    pickItemsRemote,
    pickInventoryVehiclesRemote
  } from '../../pickers.remote'

  type PositionSource = 'free' | 'article' | 'service' | 'vehicle'
  type Position = {
    description: string
    quantity: number | string
    unit: string
    unitPriceNet: number | string
    discountPercent: number | string
    taxRate: number | string
    source: PositionSource
    sourceRef: string
    sourceLabel: string
    kind: string
    articleNumber?: string
  }

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + 30)

  let type = $state<'offer' | 'cost_estimate' | 'order_confirmation'>(
    'cost_estimate'
  )
  let customerId = $state('')
  let customerLabel = $state('')
  let vehicleId = $state('')
  let vehicleLabel = $state('')
  let issueDate = $state(today)
  let dueDate = $state(due.toISOString().slice(0, 10))
  let header = $state('')
  let footer = $state('')
  let notes = $state('')

  const blankPosition = (): Position => ({
    description: '',
    quantity: 1,
    unit: 'Stk',
    unitPriceNet: 0,
    discountPercent: 0,
    taxRate: 19,
    source: 'free',
    sourceRef: '',
    sourceLabel: '',
    kind: 'article'
  })

  let positions = $state<Position[]>([blankPosition()])

  let errorMsg = $state<string | null>(null)

  const searchCustomers = (params: { q: string; page: number; size: number }) =>
    pickCustomersRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
  const searchVehicles = (params: { q: string; page: number; size: number }) =>
    pickVehiclesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()
  const searchArticles = (params: { q: string; page: number; size: number }) =>
    pickItemsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100,
      category: 'articles'
    }).run()
  const searchServices = (params: { q: string; page: number; size: number }) =>
    pickItemsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100,
      category: 'services'
    }).run()
  const searchInventoryVehicles = (params: {
    q: string
    page: number
    size: number
  }) =>
    pickInventoryVehiclesRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
    }).run()

  const round2 = (v: number) => Math.round(v * 100) / 100
  const totals = $derived.by(() => {
    let net = 0
    let tax = 0
    positions.forEach((p) => {
      const qty = Number(p.quantity) || 0
      const price = Number(p.unitPriceNet) || 0
      const disc = Number(p.discountPercent) || 0
      const t = Number(p.taxRate) || 0
      const lineNet = round2(qty * price * (1 - disc / 100))
      net = round2(net + lineNet)
      tax = round2(tax + lineNet * (t / 100))
    })
    return { net, tax, gross: round2(net + tax) }
  })

  const addPosition = () => {
    positions = [...positions, blankPosition()]
  }

  const fillItemRow = (
    idx: number,
    item: {
      id: string
      label: string
      articleNumber: string
      description: string
      kind: string
      unit: string
      unitPriceNet: number
    }
  ) => {
    const next = [...positions]
    const source: PositionSource =
      item.kind === 'service' ? 'service' : 'article'
    next[idx] = {
      ...next[idx],
      description: item.description,
      unit: item.unit || next[idx].unit,
      unitPriceNet: item.unitPriceNet,
      source,
      sourceRef: item.id,
      sourceLabel: item.label,
      kind: item.kind,
      articleNumber: item.articleNumber
    }
    positions = next
  }

  const fillVehicleRow = (
    idx: number,
    v: {
      id: string
      label: string
      plate: string | null
      vin: string | null
      make: string | null
      model: string | null
      firstRegistration: string | null
      salesPriceGross: number
      differentialTax: boolean
    }
  ) => {
    const lines = [
      [v.make, v.model].filter(Boolean).join(' '),
      v.plate ? `Kennz.: ${v.plate}` : '',
      v.vin ? `FIN: ${v.vin}` : '',
      v.firstRegistration ? `EZ: ${v.firstRegistration}` : ''
    ].filter(Boolean)
    const description = `Fahrzeug ${lines.join(' · ')}`
    const taxRate = v.differentialTax ? 0 : 19
    const priceNet = v.differentialTax
      ? v.salesPriceGross
      : Math.round((v.salesPriceGross / 1.19) * 100) / 100
    const next = [...positions]
    next[idx] = {
      ...next[idx],
      description,
      unit: 'Stk',
      unitPriceNet: priceNet,
      taxRate,
      source: 'vehicle',
      sourceRef: v.id,
      sourceLabel:
        [v.make, v.model].filter(Boolean).join(' ') || (v.plate ?? ''),
      kind: 'vehicle'
    }
    positions = next
  }

  const onSourceChange = (idx: number, next: PositionSource) => {
    const arr = [...positions]
    arr[idx] = {
      ...arr[idx],
      source: next,
      sourceRef: '',
      sourceLabel: '',
      articleNumber: undefined,
      kind:
        next === 'vehicle'
          ? 'vehicle'
          : next === 'service'
            ? 'service'
            : 'article'
    }
    if (next !== 'free') {
      arr[idx].description = ''
      arr[idx].unitPriceNet = 0
    }
    positions = arr
  }

  const removePosition = (idx: number) => {
    positions = positions.filter((_, i) => i !== idx)
  }

  /* — 0-€-Warnmodal: gleicher Pattern wie in /invoices/new — */
  let zeroOpen = $state(false)
  let zeroRows = $state<{ description: string; reason: string }[]>([])
  let pendingItems = $state<Array<ReturnType<typeof cleanPosition>>>([])

  function cleanPosition(p: Position) {
    return {
      description: p.description.trim(),
      quantity: Number(p.quantity) || 0,
      unit: p.unit,
      unitPriceNet: Number(p.unitPriceNet) || 0,
      discountPercent: Number(p.discountPercent) || 0,
      taxRate: Number(p.taxRate) || 19,
      kind: p.kind,
      articleNumber: p.articleNumber || undefined
    }
  }

  const persistOffer = async (
    cleaned: Array<ReturnType<typeof cleanPosition>>
  ) => {
    const created = await busy.run(() =>
      createOfferRemote({
        type,
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        issueDate,
        dueDate,
        header: header.trim() || undefined,
        footer: footer.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cleaned
      })
    )
    toast.success(`Dokument ${created.documentNumber} erstellt.`)
    goto(`/offers/${created.id}`, { replaceState: true })
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    const cleaned = positions
      .map((p) => cleanPosition(p))
      .filter((p) => p.description !== '')
    if (cleaned.length === 0) {
      errorMsg = 'Bitte mindestens eine Position eingeben.'
      return
    }
    const zero = cleaned
      .map((p) => {
        if (p.unitPriceNet === 0)
          return { description: p.description, reason: 'Einzelpreis 0 €' }
        if (p.discountPercent >= 100)
          return { description: p.description, reason: 'Rabatt 100 %' }
        const lineNet =
          p.quantity * p.unitPriceNet * (1 - p.discountPercent / 100)
        if (Math.abs(lineNet) < 0.005)
          return { description: p.description, reason: 'Endpreis 0 €' }
        return null
      })
      .filter((x): x is { description: string; reason: string } => x !== null)
    if (zero.length > 0) {
      zeroRows = zero
      pendingItems = cleaned
      zeroOpen = true
      return
    }
    try {
      await persistOffer(cleaned)
    } catch (err) {
      handleClientError(err)
    }
  }

  const confirmZero = async () => {
    zeroOpen = false
    try {
      await persistOffer(pendingItems)
    } catch (err) {
      handleClientError(err)
    }
  }
  const cancelZero = () => {
    zeroOpen = false
    pendingItems = []
    zeroRows = []
  }

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())
</script>

<PageHeader
  title="Neues Angebot anlegen"
  subtitle="Angebot, Kostenvoranschlag oder Auftragsbestätigung."
/>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="space-y-4"
>
  {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
    >{/if}

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Empfänger und Konditionen</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Typ *</span>
            <select class="select select-bordered w-full" bind:value={type}>
              <option value="cost_estimate">Kostenvoranschlag</option>
              <option value="offer">Angebot</option>
              <option value="order_confirmation">Auftragsbestätigung</option>
            </select>
          </label>
          <div class="flex w-full flex-col gap-1 sm:col-span-2">
            <span class="label-text">Kunde</span>
            <SearchablePicker
              bind:value={customerId}
              bind:valueLabel={customerLabel}
              placeholder="— Kunde suchen und auswählen —"
              dialogTitle="Kunden auswählen"
              search={searchCustomers}
              onSelect={() => {}}
            />
          </div>
          <div class="flex w-full flex-col gap-1 sm:col-span-2">
            <span class="label-text">Fahrzeug</span>
            <SearchablePicker
              bind:value={vehicleId}
              bind:valueLabel={vehicleLabel}
              placeholder="— optional —"
              dialogTitle="Fahrzeug auswählen"
              search={searchVehicles}
              onSelect={() => {}}
            />
          </div>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Datum *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={issueDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Gültig bis</span>
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={dueDate}
            />
          </label>
        </div>
      </fieldset>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="card-title text-base">Positionen</h3>
        <button
          type="button"
          class="btn btn-sm gap-2"
          onclick={addPosition}
          data-testid="add-position"
        >
          <Plus size={14} /> Position hinzufügen
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="table-sm table">
          <thead>
            <tr>
              <th>#</th>
              <th class="w-32">Quelle</th>
              <th>Beschreibung</th>
              <th class="w-20 text-right">Menge</th>
              <th class="w-20">Einheit</th>
              <th class="w-28 text-right">Einzelpreis</th>
              <th class="w-20 text-right">Rabatt %</th>
              <th class="w-20 text-right">MwSt %</th>
              <th class="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {#each positions as p, idx (idx)}
              <tr>
                <td class="text-base-content/60">{idx + 1}</td>
                <td>
                  <select
                    class="select select-bordered select-sm w-full"
                    value={p.source}
                    onchange={(e) =>
                      onSourceChange(
                        idx,
                        (e.target as HTMLSelectElement).value as PositionSource
                      )}
                    aria-label="Quelle"
                  >
                    <option value="free">Frei</option>
                    <option value="article">Artikel</option>
                    <option value="service">Leistung</option>
                    <option value="vehicle">Fahrzeug</option>
                  </select>
                  {#if p.source !== 'free' && p.articleNumber}
                    <div
                      class="text-base-content/60 mt-0.5 font-mono text-[10px]"
                    >
                      {p.articleNumber}
                    </div>
                  {/if}
                </td>
                <td>
                  {#if p.source === 'free'}
                    <input
                      class="input input-bordered input-sm w-full"
                      maxlength="500"
                      bind:value={p.description}
                      placeholder="Beschreibung"
                    />
                  {:else if p.sourceRef}
                    <input
                      class="input input-bordered input-sm w-full"
                      maxlength="500"
                      bind:value={p.description}
                    />
                  {:else if p.source === 'article'}
                    <SearchablePicker
                      bind:value={p.sourceRef}
                      bind:valueLabel={p.sourceLabel}
                      placeholder="— Artikel auswählen —"
                      dialogTitle="Artikel auswählen"
                      search={searchArticles}
                      onSelect={(it) => {
                        if (it)
                          fillItemRow(
                            idx,
                            it as Parameters<typeof fillItemRow>[1]
                          )
                      }}
                    />
                  {:else if p.source === 'service'}
                    <SearchablePicker
                      bind:value={p.sourceRef}
                      bind:valueLabel={p.sourceLabel}
                      placeholder="— Leistung auswählen —"
                      dialogTitle="Leistung auswählen"
                      search={searchServices}
                      onSelect={(it) => {
                        if (it)
                          fillItemRow(
                            idx,
                            it as Parameters<typeof fillItemRow>[1]
                          )
                      }}
                    />
                  {:else}
                    <SearchablePicker
                      bind:value={p.sourceRef}
                      bind:valueLabel={p.sourceLabel}
                      placeholder="— Fahrzeug aus Bestand —"
                      dialogTitle="Fahrzeug auswählen"
                      search={searchInventoryVehicles}
                      onSelect={(it) => {
                        if (it)
                          fillVehicleRow(
                            idx,
                            it as Parameters<typeof fillVehicleRow>[1]
                          )
                      }}
                    />
                  {/if}
                </td>
                <td
                  ><input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.quantity}
                  /></td
                >
                <td
                  ><input
                    class="input input-bordered input-sm w-full"
                    maxlength="20"
                    bind:value={p.unit}
                  /></td
                >
                <td
                  ><input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.unitPriceNet}
                  /></td
                >
                <td
                  ><input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    bind:value={p.discountPercent}
                  /></td
                >
                <td>
                  <select
                    class="select select-bordered select-sm w-full text-right"
                    bind:value={p.taxRate}
                  >
                    <option value={19}>19</option>
                    <option value={7}>7</option>
                    <option value={0}>0</option>
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm btn-square text-error"
                    onclick={() => removePosition(idx)}
                    aria-label="Position löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="border-base-300 flex justify-end border-t pt-3 text-sm">
        <dl class="grid w-64 grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt class="text-base-content/60">Netto</dt>
          <dd class="text-right font-mono">{formatEuro(totals.net)}</dd>
          <dt class="text-base-content/60">MwSt</dt>
          <dd class="text-right font-mono">{formatEuro(totals.tax)}</dd>
          <dt class="border-base-300 border-t pt-1 font-semibold">Brutto</dt>
          <dd
            class="border-base-300 border-t pt-1 text-right font-mono font-semibold"
          >
            {formatEuro(totals.gross)}
          </dd>
        </dl>
      </div>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Texte</legend>
        <div class="grid grid-cols-1 gap-3">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Endtext</span>
            <textarea
              class="textarea textarea-bordered min-h-20 w-full"
              maxlength="10000"
              bind:value={footer}
            ></textarea>
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Interne Notiz</span>
            <textarea
              class="textarea textarea-bordered min-h-20 w-full"
              maxlength="2000"
              bind:value={notes}
            ></textarea>
          </label>
        </div>
      </fieldset>
    </div>
  </div>

  <div class="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      class="btn btn-ghost"
      onclick={() => goto('/offers')}
      disabled={busy.active}>Abbrechen</button
    >
    <button type="submit" class="btn btn-primary" disabled={busy.active}>
      {#if busy.active}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      Speichern
    </button>
  </div>
</form>

{#if zeroOpen}
  <div class="modal modal-open" role="dialog" aria-modal="true">
    <div class="modal-box">
      <h3 class="text-lg font-bold">Position mit Endpreis 0 €</h3>
      <p class="text-base-content/70 mt-2 text-sm">
        {zeroRows.length === 1
          ? 'Eine Position'
          : `${zeroRows.length} Positionen`} hat einen Netto-Endpreis von 0 €. Soll
        das Dokument trotzdem so gespeichert werden?
      </p>
      <ul class="border-base-300 mt-3 divide-y rounded border text-sm">
        {#each zeroRows as r, i (i)}
          <li class="flex items-center justify-between gap-3 p-2">
            <span class="truncate">{r.description}</span>
            <span class="text-base-content/60 text-xs whitespace-nowrap">
              {r.reason}
            </span>
          </li>
        {/each}
      </ul>
      <div class="modal-action">
        <button
          type="button"
          class="btn btn-ghost"
          onclick={cancelZero}
          disabled={busy.active}
        >
          Zurück zur Eingabe
        </button>
        <button
          type="button"
          class="btn btn-warning"
          onclick={confirmZero}
          disabled={busy.active}
        >
          Trotzdem speichern
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      onclick={cancelZero}
      aria-label="Schließen">close</button
    >
  </div>
{/if}
