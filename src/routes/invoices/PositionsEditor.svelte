<script lang="ts" module>
  /**
   * Shared line-item (Positionen) editor for the offer and invoice
   * create pages. The module scope exports the position model plus the
   * pure helpers both pages need for their submit pipelines
   * (`cleanPosition`) and the stock-sale preload
   * (`applyVehicleToPosition`).
   */
  export type PositionSource = 'free' | 'article' | 'service' | 'vehicle'

  export type Position = {
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

  /** Inventory-vehicle picker hit (the subset used to fill a position). */
  export type PickedVehicle = {
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

  export const blankPosition = (): Position => ({
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

  /** Normalizes a position for the create-document remote calls. */
  export function cleanPosition(p: Position) {
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

  /**
   * Fills a position from an inventory vehicle. Differential-taxed
   * vehicles (§ 25a UStG) carry their gross price with 0 % VAT; regular
   * vehicles are converted to net at 19 %.
   */
  export const applyVehicleToPosition = (
    pos: Position,
    v: PickedVehicle
  ): Position => {
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
    return {
      ...pos,
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
  }
</script>

<script lang="ts">
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { Plus, Trash2 } from '@lucide/svelte'
  import {
    pickItemsRemote,
    pickInventoryVehiclesRemote
  } from '../pickers.remote'

  type Props = {
    positions: Position[]
    /** Placeholder of the free-text description input. */
    descriptionPlaceholder?: string
  }

  let {
    positions = $bindable(),
    descriptionPlaceholder = 'Beschreibung'
  }: Props = $props()

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

  /**
   * Puts an item picker hit into the given row — fills description,
   * unit and default price and sets the source from the item `kind`.
   */
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

  const fillVehicleRow = (idx: number, v: PickedVehicle) => {
    const next = [...positions]
    next[idx] = applyVehicleToPosition(next[idx], v)
    positions = next
  }

  /**
   * Keeps most of the row and resets only what the new source implies —
   * switching to 'free' keeps the description so the user doesn't have
   * to retype it; picking a record source clears text and price.
   */
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
</script>

{#snippet sourceSelect(p: Position, idx: number)}
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
    <div class="text-base-content/60 mt-0.5 font-mono text-[10px]">
      {p.articleNumber}
    </div>
  {/if}
{/snippet}

{#snippet descriptionField(p: Position, idx: number)}
  {#if p.source === 'free'}
    <input
      class="input input-bordered input-sm w-full"
      maxlength="500"
      bind:value={p.description}
      placeholder={descriptionPlaceholder}
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
      placeholder="Artikel auswählen"
      dialogTitle="Artikel auswählen"
      triggerSize="sm"
      search={searchArticles}
      onSelect={(it) => {
        if (it) fillItemRow(idx, it as Parameters<typeof fillItemRow>[1])
      }}
    />
  {:else if p.source === 'service'}
    <SearchablePicker
      bind:value={p.sourceRef}
      bind:valueLabel={p.sourceLabel}
      placeholder="Leistung auswählen"
      dialogTitle="Leistung auswählen"
      triggerSize="sm"
      search={searchServices}
      onSelect={(it) => {
        if (it) fillItemRow(idx, it as Parameters<typeof fillItemRow>[1])
      }}
    />
  {:else}
    <SearchablePicker
      bind:value={p.sourceRef}
      bind:valueLabel={p.sourceLabel}
      placeholder="Fahrzeug aus Bestand"
      dialogTitle="Fahrzeug auswählen"
      triggerSize="sm"
      search={searchInventoryVehicles}
      onSelect={(it) => {
        if (it) fillVehicleRow(idx, it as PickedVehicle)
      }}
    />
  {/if}
{/snippet}

{#snippet quantityInput(p: Position)}
  <input
    class="input input-bordered input-sm w-full text-right"
    type="number"
    step="0.01"
    min="0"
    aria-label="Menge"
    bind:value={p.quantity}
  />
{/snippet}

{#snippet unitInput(p: Position)}
  <input
    class="input input-bordered input-sm w-full"
    maxlength="20"
    aria-label="Einheit"
    bind:value={p.unit}
  />
{/snippet}

{#snippet priceInput(p: Position)}
  <input
    class="input input-bordered input-sm w-full text-right"
    type="number"
    step="0.01"
    min="0"
    aria-label="Einzelpreis"
    bind:value={p.unitPriceNet}
  />
{/snippet}

{#snippet discountInput(p: Position)}
  <input
    class="input input-bordered input-sm w-full text-right"
    type="number"
    step="0.01"
    min="0"
    max="100"
    aria-label="Rabatt %"
    bind:value={p.discountPercent}
  />
{/snippet}

{#snippet taxSelect(p: Position)}
  <select
    class="select select-bordered select-sm w-full text-right"
    aria-label="MwSt %"
    bind:value={p.taxRate}
  >
    <option value={19}>19</option>
    <option value={7}>7</option>
    <option value={0}>0</option>
  </select>
{/snippet}

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

    <!-- >= md: the classic 9-column editor table. -->
    <div class="hidden overflow-x-auto md:block">
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
              <td>{@render sourceSelect(p, idx)}</td>
              <td>{@render descriptionField(p, idx)}</td>
              <td>{@render quantityInput(p)}</td>
              <td>{@render unitInput(p)}</td>
              <td>{@render priceInput(p)}</td>
              <td>{@render discountInput(p)}</td>
              <td>{@render taxSelect(p)}</td>
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

    <!-- < md: one stacked, labeled block per position. -->
    <div class="space-y-3 md:hidden">
      {#each positions as p, idx (idx)}
        <div class="card border-base-300 bg-base-100 border">
          <div class="card-body gap-2 p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium">Position {idx + 1}</span>
              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square text-error"
                onclick={() => removePosition(idx)}
                aria-label="Position löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <label class="col-span-2 flex flex-col gap-1">
                <span class="label-text text-xs">Quelle</span>
                {@render sourceSelect(p, idx)}
              </label>
              <div class="col-span-2 flex flex-col gap-1">
                <span class="label-text text-xs">Beschreibung</span>
                {@render descriptionField(p, idx)}
              </div>
              <label class="flex flex-col gap-1">
                <span class="label-text text-xs">Menge</span>
                {@render quantityInput(p)}
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text text-xs">Einheit</span>
                {@render unitInput(p)}
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text text-xs">Einzelpreis</span>
                {@render priceInput(p)}
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text text-xs">Rabatt %</span>
                {@render discountInput(p)}
              </label>
              <label class="flex flex-col gap-1">
                <span class="label-text text-xs">MwSt %</span>
                {@render taxSelect(p)}
              </label>
            </div>
          </div>
        </div>
      {/each}
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
