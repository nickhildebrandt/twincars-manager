<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import { Plus, Trash2, ArrowRight } from '@lucide/svelte'
  import {
    getOfferRemote,
    convertOfferToInvoiceRemote
  } from '../../offers.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { documentTypeLabel } from '$lib/utils/status-labels'

  const id = untrack(() => page.params.id!)

  /**
   * Top-level await: SSR carries the offer payload, hydration reuses the
   * cache. The convert page is suspendable on its own because the user
   * always reaches it from the offer detail.
   */
  const offer = await getOfferRemote({ id })

  /**
   * Local editable state — seeded from the offer's positions. The user
   * can change quantities, prices, discounts, drop lines that were not
   * actually delivered, and tweak issue / service / due dates before
   * creating the invoice. The original offer stays untouched until the
   * server confirms the conversion.
   */
  type Position = {
    /** stays in the form even when the user disables it (visual diff). */
    enabled: boolean
    description: string
    quantity: number | string
    unit: string
    unitPriceNet: number | string
    discountPercent: number | string
    taxRate: number | string
    kind: string
    articleNumber: string
  }

  const today = new Date().toISOString().slice(0, 10)
  const dueIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  let issueDate = $state(today)
  let serviceDate = $state(today)
  let dueDate = $state(dueIso)
  let paymentMethod = $state('Überweisung')
  let header = $state(offer.doc.header ?? '')
  let footer = $state(offer.doc.footer ?? '')
  let notes = $state(offer.doc.notes ?? '')
  let errorMsg = $state<string | null>(null)

  let positions = $state<Position[]>(
    offer.items.map((it) => ({
      enabled: true,
      description: it.description,
      quantity: Number(it.quantity),
      unit: it.unit ?? 'Stk',
      unitPriceNet: Number(it.unitPriceNet),
      discountPercent: Number(it.discountPercent),
      taxRate: Number(it.taxRate),
      kind: it.kind ?? 'article',
      articleNumber: it.articleNumber ?? ''
    }))
  )

  const round2 = (v: number) => Math.round(v * 100) / 100

  /** Live totals over the currently enabled positions. */
  const totals = $derived.by(() => {
    let net = 0
    let tax = 0
    for (const p of positions) {
      if (!p.enabled) continue
      const qty = Number(p.quantity) || 0
      const price = Number(p.unitPriceNet) || 0
      const disc = Number(p.discountPercent) || 0
      const t = Number(p.taxRate) || 0
      const lineNet = round2(qty * price * (1 - disc / 100))
      net = round2(net + lineNet)
      tax = round2(tax + lineNet * (t / 100))
    }
    return { net, tax, gross: round2(net + tax) }
  })

  const removePosition = (idx: number) => {
    positions = positions.filter((_, i) => i !== idx)
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    errorMsg = null
    const cleaned = positions
      .filter((p) => p.enabled)
      .map((p) => ({
        description: p.description.trim(),
        quantity: Number(p.quantity) || 0,
        unit: p.unit,
        unitPriceNet: Number(p.unitPriceNet) || 0,
        discountPercent: Number(p.discountPercent) || 0,
        taxRate: Number(p.taxRate) || 19,
        kind: p.kind,
        articleNumber: p.articleNumber.trim() || undefined
      }))
      .filter((p) => p.description !== '')
    if (cleaned.length === 0) {
      errorMsg = 'Bitte mindestens eine aktive Position übernehmen.'
      return
    }
    try {
      const created = await busy.run(() =>
        convertOfferToInvoiceRemote({
          offerId: id,
          values: {
            customerId: offer.doc.customerId ?? undefined,
            vehicleId: offer.doc.vehicleId ?? undefined,
            issueDate,
            serviceDate,
            dueDate,
            paymentMethod,
            header: header.trim() || undefined,
            footer: footer.trim() || undefined,
            notes: notes.trim() || undefined,
            items: cleaned
          }
        })
      )
      toast.success(
        `Rechnung ${created.documentNumber} aus Kostenvoranschlag erstellt.`
      )
      goto(`/invoices/${created.id}`)
    } catch (err) {
      handleClientError(err, 'Umwandlung fehlgeschlagen')
    }
  }
</script>

<PageHeader
  title={`${documentTypeLabel(offer.doc.type)} ${offer.doc.documentNumber} → Rechnung`}
  back={`/offers/${id}`}
/>

<form onsubmit={submit} class="space-y-4">
  {#if errorMsg}
    <div class="alert alert-error"><span>{errorMsg}</span></div>
  {/if}

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Konditionen der neuen Rechnung</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Rechnungsdatum *</span>
            <input
              class="input input-bordered w-full"
              type="date"
              required
              bind:value={issueDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Leistungsdatum</span>
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={serviceDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1">
            <span class="label-text">Fälligkeit</span>
            <input
              class="input input-bordered w-full"
              type="date"
              bind:value={dueDate}
            />
          </label>
          <label class="flex w-full flex-col gap-1 sm:col-span-3">
            <span class="label-text">Zahlungsart</span>
            <select
              class="select select-bordered w-full"
              bind:value={paymentMethod}
            >
              <option>Überweisung</option>
              <option>Bar</option>
              <option>Lastschrift</option>
              <option>Karte</option>
            </select>
          </label>
        </div>
      </fieldset>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-3">
      <h3 class="card-title text-base">Positionen anpassen</h3>
      <p class="text-base-content/60 text-sm">
        Haken Sie nur die Positionen an, die tatsächlich umgesetzt wurden.
        Mengen, Einzelpreise und Rabatte können vor der Umwandlung noch
        angepasst werden.
      </p>
      <div class="overflow-x-auto">
        <table class="table-sm table">
          <thead>
            <tr>
              <th class="w-10"></th>
              <th>#</th>
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
              <tr class:opacity-50={!p.enabled}>
                <td>
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    bind:checked={p.enabled}
                    aria-label="Position übernehmen"
                  />
                </td>
                <td class="text-base-content/60">{idx + 1}</td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full"
                    maxlength="500"
                    bind:value={p.description}
                    disabled={!p.enabled}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.quantity}
                    disabled={!p.enabled}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full"
                    maxlength="20"
                    bind:value={p.unit}
                    disabled={!p.enabled}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.unitPriceNet}
                    disabled={!p.enabled}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    bind:value={p.discountPercent}
                    disabled={!p.enabled}
                  />
                </td>
                <td>
                  <select
                    class="select select-bordered select-sm w-full text-right"
                    bind:value={p.taxRate}
                    disabled={!p.enabled}
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
            <span class="label-text">Werbe-/Endtext</span>
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
      onclick={() => goto(`/offers/${id}`)}
      disabled={busy.active}
    >
      Abbrechen
    </button>
    <button type="submit" class="btn btn-primary gap-2" disabled={busy.active}>
      {#if busy.active}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <ArrowRight size={16} />
      {/if}
      Rechnung erstellen
    </button>
  </div>
</form>
