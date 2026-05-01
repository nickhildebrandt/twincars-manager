<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { createOfferRemote } from '../offers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { Plus, Trash2, Package, Car, Pencil } from '@lucide/svelte'
  import {
    pickCustomersRemote,
    pickVehiclesRemote,
    pickItemsRemote,
    pickInventoryVehiclesRemote
  } from '../../pickers.remote'

  type PositionSource = 'free' | 'item' | 'vehicle'
  type Position = {
    description: string
    quantity: number | string
    unit: string
    unitPriceNet: number | string
    discountPercent: number | string
    taxRate: number | string
    source: PositionSource
    sourceRef?: string
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
    kind: 'article'
  })

  let positions = $state<Position[]>([blankPosition()])

  let errorMsg = $state<string | null>(null)

  let itemPickerValue = $state('')
  let itemPickerLabel = $state('')
  let vehicleSourceValue = $state('')
  let vehicleSourceLabel = $state('')

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
  const searchItems = (params: { q: string; page: number; size: number }) =>
    pickItemsRemote({
      ...params,
      size: params.size as 10 | 25 | 50 | 100
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

  const addItemPosition = (item: {
    id: string
    label: string
    articleNumber: string
    description: string
    kind: string
    unit: string
    unitPriceNet: number
  }) => {
    positions = [
      ...positions,
      {
        description: item.description,
        quantity: 1,
        unit: item.unit,
        unitPriceNet: item.unitPriceNet,
        discountPercent: 0,
        taxRate: 19,
        source: 'item',
        sourceRef: item.id,
        kind: item.kind,
        articleNumber: item.articleNumber
      }
    ]
    itemPickerValue = ''
    itemPickerLabel = ''
  }

  const addVehiclePosition = (v: {
    id: string
    label: string
    plate: string | null
    vin: string | null
    make: string | null
    model: string | null
    firstRegistration: string | null
    salesPriceGross: number
    differentialTax: boolean
  }) => {
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
    positions = [
      ...positions,
      {
        description,
        quantity: 1,
        unit: 'Stk',
        unitPriceNet: priceNet,
        discountPercent: 0,
        taxRate,
        source: 'vehicle',
        sourceRef: v.id,
        kind: 'vehicle'
      }
    ]
    vehicleSourceValue = ''
    vehicleSourceLabel = ''
  }

  const removePosition = (idx: number) => {
    positions = positions.filter((_, i) => i !== idx)
  }

  const sourceBadge = (s: PositionSource) =>
    s === 'item'
      ? { class: 'badge-info', label: 'Artikel' }
      : s === 'vehicle'
        ? { class: 'badge-warning', label: 'Fahrzeug' }
        : { class: 'badge-ghost', label: 'Frei' }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    const cleaned = positions
      .map((p) => ({
        description: p.description.trim(),
        quantity: Number(p.quantity) || 0,
        unit: p.unit,
        unitPriceNet: Number(p.unitPriceNet) || 0,
        discountPercent: Number(p.discountPercent) || 0,
        taxRate: Number(p.taxRate) || 19,
        kind: p.kind,
        articleNumber: p.articleNumber || undefined
      }))
      .filter((p) => p.description !== '')
    if (cleaned.length === 0) {
      errorMsg = 'Bitte mindestens eine Position eingeben.'
      return
    }
    try {
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
      goto(`/offers/${created.id}`)
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="Neues Angebot anlegen"
  subtitle="Angebot, Kostenvoranschlag oder Auftragsbestätigung."
/>

<form onsubmit={submit} class="space-y-4">
  {#if errorMsg}<div class="alert alert-error"><span>{errorMsg}</span></div
    >{/if}

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Empfänger und Konditionen</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="form-control">
            <span class="label-text">Typ *</span>
            <select class="select select-bordered" bind:value={type}>
              <option value="cost_estimate">Kostenvoranschlag</option>
              <option value="offer">Angebot</option>
              <option value="order_confirmation">Auftragsbestätigung</option>
            </select>
          </label>
          <div class="form-control sm:col-span-2">
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
          <div class="form-control sm:col-span-2">
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
          <label class="form-control">
            <span class="label-text">Datum *</span>
            <input
              class="input input-bordered"
              type="date"
              required
              bind:value={issueDate}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Gültig bis</span>
            <input
              class="input input-bordered"
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
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm gap-2"
            onclick={addPosition}
            data-testid="add-free-position"
          >
            <Pencil size={14} /> Freie Position
          </button>
          <div class="form-control">
            <SearchablePicker
              bind:value={itemPickerValue}
              bind:valueLabel={itemPickerLabel}
              placeholder="+ Artikel/Leistung"
              dialogTitle="Artikel auswählen"
              search={searchItems}
              onSelect={(it) => {
                if (it)
                  addItemPosition(it as Parameters<typeof addItemPosition>[0])
              }}
            />
          </div>
          <div class="form-control">
            <SearchablePicker
              bind:value={vehicleSourceValue}
              bind:valueLabel={vehicleSourceLabel}
              placeholder="+ Fahrzeug aus Bestand"
              dialogTitle="Fahrzeug aus Bestand auswählen"
              search={searchInventoryVehicles}
              onSelect={(it) => {
                if (it)
                  addVehiclePosition(
                    it as Parameters<typeof addVehiclePosition>[0]
                  )
              }}
            />
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table-sm table">
          <thead>
            <tr>
              <th>#</th>
              <th class="w-24">Quelle</th>
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
              {@const b = sourceBadge(p.source)}
              <tr>
                <td class="text-base-content/60">{idx + 1}</td>
                <td>
                  <span class="badge badge-sm {b.class} gap-1">
                    {#if p.source === 'item'}
                      <Package size={10} />
                    {:else if p.source === 'vehicle'}
                      <Car size={10} />
                    {:else}
                      <Pencil size={10} />
                    {/if}
                    {b.label}
                  </span>
                  {#if p.source === 'item' && p.articleNumber}
                    <div
                      class="text-base-content/60 mt-0.5 font-mono text-[10px]"
                    >
                      {p.articleNumber}
                    </div>
                  {/if}
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full"
                    maxlength="500"
                    bind:value={p.description}
                    placeholder="Beschreibung"
                  />
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
          <label class="form-control">
            <span class="label-text">Endtext</span>
            <textarea
              class="textarea textarea-bordered min-h-20"
              maxlength="10000"
              bind:value={footer}
            ></textarea>
          </label>
          <label class="form-control">
            <span class="label-text">Interne Notiz</span>
            <textarea
              class="textarea textarea-bordered min-h-20"
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
