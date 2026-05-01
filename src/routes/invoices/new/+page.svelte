<script lang="ts">
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import SearchablePicker from '$lib/components/ui/SearchablePicker.svelte'
  import { createInvoiceRemote } from '../invoices.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { formatEuro } from '$lib/utils/money'
  import { Plus, Trash2 } from '@lucide/svelte'
  import { pickCustomersRemote, pickVehiclesRemote } from '../../pickers.remote'

  type Position = {
    description: string
    quantity: number | string
    unit: string
    unitPriceNet: number | string
    discountPercent: number | string
    taxRate: number | string
  }

  const today = new Date().toISOString().slice(0, 10)
  const due = new Date()
  due.setDate(due.getDate() + 14)
  const dueIso = due.toISOString().slice(0, 10)

  let customerId = $state('')
  let customerLabel = $state('')
  let vehicleId = $state('')
  let vehicleLabel = $state('')
  let issueDate = $state(today)
  let dueDate = $state(dueIso)
  let serviceDate = $state(today)
  let paymentMethod = $state('Überweisung')
  let header = $state('')
  let footer = $state('')
  let notes = $state('')

  let positions = $state<Position[]>([
    {
      description: '',
      quantity: 1,
      unit: 'Stk',
      unitPriceNet: 0,
      discountPercent: 0,
      taxRate: 19
    }
  ])

  let busy = $state(false)
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
    positions = [
      ...positions,
      {
        description: '',
        quantity: 1,
        unit: 'Stk',
        unitPriceNet: 0,
        discountPercent: 0,
        taxRate: 19
      }
    ]
  }
  const removePosition = (idx: number) => {
    positions = positions.filter((_, i) => i !== idx)
  }

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
        taxRate: Number(p.taxRate) || 19
      }))
      .filter((p) => p.description !== '')
    if (cleaned.length === 0) {
      errorMsg = 'Bitte mindestens eine Position mit Beschreibung anlegen.'
      return
    }
    busy = true
    try {
      const created = await createInvoiceRemote({
        customerId: customerId || undefined,
        vehicleId: vehicleId || undefined,
        issueDate,
        serviceDate,
        dueDate,
        paymentMethod,
        header: header.trim() || undefined,
        footer: footer.trim() || undefined,
        notes: notes.trim() || undefined,
        items: cleaned
      })
      toast.success(`Rechnung ${created.documentNumber} erstellt.`)
      goto(`/invoices/${created.id}`)
    } catch (err) {
      handleClientError(err)
    } finally {
      busy = false
    }
  }
</script>

<PageHeader
  title="Neue Rechnung anlegen"
  subtitle="Positionen, Kunde und Konditionen erfassen."
/>

<form onsubmit={submit} class="space-y-4">
  {#if errorMsg}
    <div class="alert alert-error"><span>{errorMsg}</span></div>
  {/if}

  <div class="card border-base-300 bg-base-100 border">
    <div class="card-body gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Empfänger und Konditionen</legend>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div class="form-control">
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
            <span class="label-text">Rechnungsdatum *</span>
            <input
              class="input input-bordered"
              type="date"
              required
              bind:value={issueDate}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Leistungsdatum</span>
            <input
              class="input input-bordered"
              type="date"
              bind:value={serviceDate}
            />
          </label>
          <label class="form-control">
            <span class="label-text">Fälligkeit</span>
            <input
              class="input input-bordered"
              type="date"
              bind:value={dueDate}
            />
          </label>
          <label class="form-control sm:col-span-3">
            <span class="label-text">Zahlungsart</span>
            <select class="select select-bordered" bind:value={paymentMethod}>
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
      <div class="flex items-center justify-between">
        <h3 class="card-title text-base">Positionen</h3>
        <button type="button" class="btn btn-sm gap-2" onclick={addPosition}>
          <Plus size={14} /> Position hinzufügen
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="table-sm table">
          <thead>
            <tr>
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
              <tr>
                <td class="text-base-content/60">{idx + 1}</td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full"
                    maxlength="500"
                    bind:value={p.description}
                    placeholder="z. B. Ölwechsel inkl. Filter"
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.quantity}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full"
                    maxlength="20"
                    bind:value={p.unit}
                  />
                </td>
                <td>
                  <input
                    class="input input-bordered input-sm w-full text-right"
                    type="number"
                    step="0.01"
                    min="0"
                    bind:value={p.unitPriceNet}
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
                  />
                </td>
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
            <span class="label-text">Werbe-/Endtext</span>
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
      onclick={() => goto('/invoices')}
      disabled={busy}
    >
      Abbrechen
    </button>
    <button type="submit" class="btn btn-primary" disabled={busy}>
      {#if busy}<span class="loading loading-spinner loading-sm"></span>{/if}
      Rechnung speichern
    </button>
  </div>
</form>
