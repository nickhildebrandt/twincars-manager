<script lang="ts">
  import type { RemoteQueryUpdate } from '@sveltejs/kit'
  import { Warehouse } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { purchaseVehicleIntoStockRemote } from './vehicles.remote'

  /**
   * Ankauf confirm modal, opened from the vehicle detail page of a
   * CUSTOMER vehicle. Asks for the Ankaufspreis (optional, gross EUR)
   * and the Ankaufsdatum (required, defaults to today), then re-hangs
   * the vehicle into the sales stock via
   * `purchaseVehicleIntoStockRemote` — the current owner becomes the
   * Vorbesitzer and a `vehicle_purchases` history row is written.
   *
   * Buttons follow the always-clickable rule: only `busy.active`
   * disables them; validation happens at click time with a German
   * error summary.
   */
  type Props = {
    open: boolean
    vehicleId: string
    /**
     * Fresh query instances for the single-flight refresh, built by
     * the HOST at call time against the exact args currently rendered
     * (CONTRIBUTING section 5). The server pairs them with
     * `requested(...).refreshAll()`, so the detail page flips to the
     * Verkaufsbestand state inside the same response.
     */
    buildUpdates?: () => RemoteQueryUpdate[]
    onDone?: () => void
  }

  let {
    open = $bindable(false),
    vehicleId,
    buildUpdates,
    onDone
  }: Props = $props()

  const todayIso = (): string => new Date().toISOString().slice(0, 10)

  let purchaseDate = $state(todayIso())
  let purchasePrice = $state<number | string>('')
  let errorMsg = $state<string | null>(null)

  const reset = () => {
    purchaseDate = todayIso()
    purchasePrice = ''
    errorMsg = null
  }

  const close = () => {
    open = false
    reset()
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    if (!purchaseDate) {
      errorMsg = 'Bitte ein Ankaufsdatum eingeben.'
      return
    }
    if (
      purchasePrice !== '' &&
      (!Number.isFinite(Number(purchasePrice)) || Number(purchasePrice) < 0)
    ) {
      errorMsg = 'Bitte einen gültigen Ankaufspreis (mindestens 0) eingeben.'
      return
    }
    errorMsg = null
    try {
      await busy.run(() => {
        const invocation = purchaseVehicleIntoStockRemote({
          id: vehicleId,
          purchaseDate,
          ...(purchasePrice !== ''
            ? { purchasePrice: Number(purchasePrice) }
            : {})
        })
        // Single-flight: ship the host's live query instances along so
        // the server refreshes them in the same response.
        return buildUpdates ? invocation.updates(...buildUpdates()) : invocation
      })
      toast.success('Fahrzeug in den Verkaufsbestand übernommen.')
      close()
      onDone?.()
    } catch (err) {
      handleClientError(
        err,
        'Fahrzeug konnte nicht in den Verkaufsbestand übernommen werden'
      )
    }
  }
</script>

{#if open}
  <!-- Native `open` keeps the dialog content in the accessibility
       tree (screen readers + role queries); DaisyUI styles `[open]`
       identically to `.modal-open`. -->
  <dialog class="modal modal-open" open>
    <div class="modal-box">
      <h3 class="text-lg font-semibold">
        <Warehouse size={18} class="inline-block" />
        Ankauf: in Verkaufsbestand übernehmen
      </h3>
      <p class="text-base-content/70 py-2 text-sm">
        Der aktuelle Halter wird als Vorbesitzer vermerkt und das Fahrzeug
        erscheint anschließend unter "Zu verkaufende Fahrzeuge". Dokumente und
        Historie bleiben am Fahrzeug erhalten; die Fotogalerie startet leer.
      </p>
      <form onsubmit={submit} novalidate class="mt-1 flex flex-col gap-3">
        {#if errorMsg}
          <div class="alert alert-error" role="alert">
            <span>{errorMsg}</span>
          </div>
        {/if}

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Ankaufspreis (brutto, EUR, optional)</span>
          <input
            type="number"
            class="input input-bordered w-full"
            min="0"
            step="0.01"
            bind:value={purchasePrice}
          />
        </label>

        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Ankaufsdatum *</span>
          <input
            type="date"
            class="input input-bordered w-full"
            bind:value={purchaseDate}
          />
        </label>

        <div class="modal-action">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={close}
            disabled={busy.active}
          >
            Abbrechen
          </button>
          <!--
            Always-clickable rule: only busy.active disables. Missing
            date surfaces the German error summary at click time.
          -->
          <button type="submit" class="btn btn-primary" disabled={busy.active}>
            {#if busy.active}
              <span class="loading loading-spinner loading-sm"></span>
            {/if}
            Ankauf übernehmen
          </button>
        </div>
      </form>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={close}
    ></button>
  </dialog>
{/if}
