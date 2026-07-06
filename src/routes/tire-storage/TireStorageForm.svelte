<script lang="ts" module>
  import {
    check,
    minLength,
    object,
    picklist,
    pipe,
    string,
    unknown
  } from 'valibot'

  /**
   * Client-side schema mirroring the rules previously enforced ad hoc
   * in `submit`: a customer and a season are required, the quantity
   * must be between 1 and 20.
   */
  const tireStorageSchema = object({
    customerId: pipe(string(), minLength(1, 'Bitte einen Kunden auswählen.')),
    season: picklist(
      ['summer', 'winter', 'allseason'],
      'Bitte eine Saison wählen.'
    ),
    quantity: pipe(
      unknown(),
      check((v) => {
        const n = Number(v)
        return Number.isFinite(n) && n >= 1 && n <= 20
      }, 'Stückzahl muss zwischen 1 und 20 liegen.')
    )
  })
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { goto } from '$app/navigation'
  import type { TireStorage } from '$lib/server/db/schema'
  import { busy } from '$lib/stores/busy.svelte'
  import { formDirty } from '$lib/stores/form-dirty.svelte'
  import { creationFlow, currentUrl } from '$lib/stores/creation-flow.svelte'
  import CustomerVehiclePicker from '$lib/components/ui/CustomerVehiclePicker.svelte'
  import FormField from '$lib/components/ui/FormField.svelte'
  import {
    useFormValidation,
    validationClasses,
    selectValidationClasses
  } from '$lib/utils/form-validation.svelte'
  import { Trash2, ImagePlus } from '@lucide/svelte'
  import { toast } from '$lib/stores/toast.svelte'

  /**
   * Props for the tire-storage form.
   *
   * `initial` is read once at mount time to seed the editable
   * `$state` variables — subsequent prop changes do not reset the
   * form. The submit / cancel buttons read the global busy store
   * directly so a pending mutation always disables them, even before
   * the 250 ms overlay appears.
   */
  type Props = {
    initial?: Partial<Omit<TireStorage, 'profileMm'>> & {
      profileMm?: number | string | null
      customerLabel?: string
      vehicleLabel?: string
    }
    onSave: (values: TireStorageFormValues) => Promise<void> | void
    onCancel?: () => void
  }

  export type TireStoragePhoto = {
    mime: string
    data: string
    caption?: string
  }

  export type TireStorageFormValues = {
    customerId: string
    vehicleId?: string
    brand?: string
    model?: string
    size?: string
    profileMm?: number
    dotYear?: number
    season?: 'summer' | 'winter' | 'allseason'
    quantity?: number
    photos?: TireStoragePhoto[]
    notes?: string
    storedAt?: string
    retrievedAt?: string
  }

  const { initial = {}, onSave, onCancel }: Props = $props()
  const init = untrack(() => ({ ...initial }))

  type LocalPhoto = TireStoragePhoto & { id: string }

  /**
   * JSON-serializable snapshot of every form field (photos included,
   * base64) — pushed into the creation-flow store when the user jumps
   * to a full-page create and restored (below) when they come back.
   */
  type Draft = {
    customerId: string
    customerLabel: string
    vehicleId: string
    vehicleLabel: string
    brand: string
    model: string
    size: string
    profileMm: string
    dotYear: string
    season: 'summer' | 'winter' | 'allseason' | ''
    quantity: string
    notes: string
    storedAt: string
    photos: LocalPhoto[]
  }

  // Returning from a full-page create? Consume the pending return for
  // THIS page exactly once — its draft wins over `initial`.
  const pending = untrack(() => creationFlow.pendingReturnFor(currentUrl()))
  const draft = (pending?.draft ?? null) as Draft | null

  let customerId = $state(draft?.customerId ?? init.customerId ?? '')
  let customerLabel = $state(draft?.customerLabel ?? init.customerLabel ?? '')
  let vehicleId = $state(draft?.vehicleId ?? init.vehicleId ?? '')
  let vehicleLabel = $state(draft?.vehicleLabel ?? init.vehicleLabel ?? '')
  let brand = $state(draft?.brand ?? init.brand ?? '')
  let model = $state(draft?.model ?? init.model ?? '')
  let size = $state(draft?.size ?? init.size ?? '')
  let profileMm = $state(
    draft?.profileMm ?? (init.profileMm != null ? String(init.profileMm) : '')
  )
  let dotYear = $state(
    draft?.dotYear ?? (init.dotYear != null ? String(init.dotYear) : '')
  )
  let season = $state<'summer' | 'winter' | 'allseason' | ''>(
    draft?.season ??
      (init.season as 'summer' | 'winter' | 'allseason' | undefined) ??
      ''
  )
  let quantity = $state(
    draft?.quantity ?? (init.quantity != null ? String(init.quantity) : '4')
  )
  let notes = $state(draft?.notes ?? init.notes ?? '')
  let storedAt = $state(
    draft?.storedAt ?? init.storedAt ?? new Date().toISOString().slice(0, 10)
  )

  let photos = $state<LocalPhoto[]>(
    draft?.photos ??
      (init.photos ?? []).map((p, i) => ({ ...p, id: `init-${i}` }))
  )

  // A successful create auto-selects the new entity in the picker
  // that started the flow.
  if (pending?.result) {
    if (pending.originField === 'customerId') {
      customerId = pending.result.id
      customerLabel = pending.result.label
    } else if (pending.originField === 'vehicleId') {
      vehicleId = pending.result.id
      vehicleLabel = pending.result.label
    }
  }
  // A restored draft is unsaved user input — re-arm the leave guard.
  if (draft) untrack(() => formDirty.set(true))

  let errorMsg = $state<string | null>(null)
  let fileInput = $state<HTMLInputElement | null>(null)

  const buildDraft = (): Draft => ({
    customerId,
    customerLabel,
    vehicleId,
    vehicleLabel,
    brand,
    model,
    size,
    profileMm,
    dotYear,
    season,
    quantity,
    notes,
    storedAt,
    photos: photos.map((p) => ({ ...p }))
  })

  // Cycle guard: no create for an entity type already being created
  // somewhere in the active chain.
  const canCreateCustomer = $derived(
    !creationFlow.activeEntities().has('customer')
  )
  const canCreateVehicle = $derived(
    !creationFlow.activeEntities().has('vehicle')
  )

  const startCreate = (
    entity: 'customer' | 'vehicle',
    originField: string,
    target: string
  ) => {
    creationFlow.start({
      entity,
      returnUrl: currentUrl(),
      originField,
      draft: buildDraft(),
      createdAt: Date.now()
    })
    // The draft carries the input — silence the unsaved-changes guard.
    formDirty.clear()
    goto(target)
  }

  /**
   * Validation handle for the Submit button gate and the per-field
   * error display. Field errors only surface once the field was
   * touched (blur / selection) or a submit was attempted.
   */
  const fv = useFormValidation(tireStorageSchema, () => ({
    customerId,
    season,
    quantity
  }))

  const err = (k: string): string | null =>
    (fv.errors as Record<string, string | null>)[k] ?? null
  const wasTouched = (k: string): boolean =>
    (fv.touched as Record<string, boolean>)[k] === true
  /**
   * Drag-and-drop overlay state for the photo section. `dragDepth`
   * tracks nested dragenter events so crossing child boundaries
   * (e.g. existing thumbnails) doesn't prematurely clear the flag.
   */
  let dragActive = $state(false)
  let dragDepth = 0

  const markDirty = () => formDirty.set(true)
  $effect(() => () => formDirty.clear())

  const readDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  /**
   * Shared ingestion path for picked + dropped files. Validation and
   * toast messages match the picker exactly.
   */
  const ingestFiles = async (files: File[]) => {
    if (files.length === 0) return
    const MAX = 5 * 1024 * 1024
    for (const file of files) {
      if (!/^image\//.test(file.type)) {
        toast.error(`„${file.name}" ist keine Bilddatei.`)
        return
      }
      if (file.size > MAX) {
        toast.error(`„${file.name}" ist größer als 5 MB.`)
        return
      }
    }
    for (const file of files) {
      const dataUrl = await readDataUrl(file)
      // Strip the `data:<mime>;base64,` prefix — the server stores
      // only the raw payload + mime metadata side by side.
      const commaAt = dataUrl.indexOf(',')
      const data = commaAt >= 0 ? dataUrl.slice(commaAt + 1) : dataUrl
      photos = [
        ...photos,
        {
          id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          mime: file.type,
          data
        }
      ]
    }
    markDirty()
  }

  const onFilesPicked = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    await ingestFiles(files)
    if (fileInput) fileInput.value = ''
  }

  const isFileDrag = (e: DragEvent): boolean => {
    const types = e.dataTransfer?.types
    if (!types) return false
    return Array.from(types as unknown as string[]).includes('Files')
  }

  const onPhotoDragEnter = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth += 1
    dragActive = true
  }

  const onPhotoDragOver = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    dragActive = true
  }

  const onPhotoDragLeave = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) dragActive = false
  }

  const onPhotoDrop = async (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth = 0
    dragActive = false
    const files = Array.from(e.dataTransfer?.files ?? [])
    await ingestFiles(files)
  }

  const removePhoto = (id: string) => {
    photos = photos.filter((p) => p.id !== id)
    markDirty()
  }

  const updateCaption = (id: string, caption: string) => {
    photos = photos.map((p) => (p.id === id ? { ...p, caption } : p))
    markDirty()
  }

  const photoSrc = (p: LocalPhoto): string =>
    p.data.startsWith('data:') ? p.data : `data:${p.mime};base64,${p.data}`

  const trimOrUndef = (v: string) => {
    const t = v.trim()
    return t === '' ? undefined : t
  }

  const numOrUndef = (v: string) => {
    if (v.trim() === '') return undefined
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }

  const submit = async (e: Event) => {
    e.preventDefault()
    fv.markAllTouched()
    if (!fv.valid) {
      const errs = fv.errors as Record<string, string | null>
      errorMsg =
        errs._form ??
        Object.values(errs).find((v) => v != null) ??
        'Bitte prüfen Sie Ihre Eingaben.'
      return
    }
    errorMsg = null
    const qty = numOrUndef(quantity) ?? 4
    formDirty.clear()
    await onSave({
      customerId,
      vehicleId: vehicleId || undefined,
      brand: trimOrUndef(brand),
      model: trimOrUndef(model),
      size: trimOrUndef(size),
      profileMm: numOrUndef(profileMm),
      dotYear: numOrUndef(dotYear),
      season: season || undefined,
      quantity: qty,
      photos: photos.map((p) => ({
        mime: p.mime,
        data: p.data,
        caption: p.caption
      })),
      notes: trimOrUndef(notes),
      storedAt: storedAt || undefined
    })
  }
</script>

<form
  onsubmit={submit}
  oninput={markDirty}
  onchange={markDirty}
  class="card border-base-300 bg-base-100 border"
>
  <div class="card-body gap-4">
    {#if errorMsg}
      <div class="alert alert-error">
        <span>{errorMsg}</span>
      </div>
    {/if}

    {#if initial.storageNumber}
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Lagernummer</legend>
        <input
          class="input input-bordered w-full font-mono"
          readonly
          value={initial.storageNumber}
        />
      </fieldset>
    {/if}

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Kunde / Fahrzeug</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CustomerVehiclePicker
          bind:customerId
          bind:customerLabel
          bind:vehicleId
          bind:vehicleLabel
          customerRequired
          vehicleFieldLabel="Fahrzeug (optional)"
          customerError={wasTouched('customerId') ? err('customerId') : null}
          onChange={() => {
            fv.markTouched('customerId')
            markDirty()
          }}
          onCreateCustomer={canCreateCustomer
            ? () => startCreate('customer', 'customerId', '/customers/new')
            : undefined}
          onCreateVehicle={canCreateVehicle
            ? () => startCreate('vehicle', 'vehicleId', '/vehicles/new')
            : undefined}
        />
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Reifen</legend>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Marke</span>
          <input
            class="input input-bordered w-full"
            maxlength="80"
            bind:value={brand}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Modell</span>
          <input
            class="input input-bordered w-full"
            maxlength="120"
            bind:value={model}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Reifengröße</span>
          <input
            class="input input-bordered w-full"
            maxlength="40"
            placeholder="z.B. 205/55 R16"
            bind:value={size}
          />
        </label>
        <FormField
          label="Saison"
          required
          error={wasTouched('season') ? err('season') : null}
        >
          <select
            class={selectValidationClasses(err('season'), wasTouched('season'))}
            bind:value={season}
            onblur={() => fv.markTouched('season')}
          >
            <option value="">-</option>
            <option value="summer">Sommer</option>
            <option value="winter">Winter</option>
            <option value="allseason">Ganzjahr</option>
          </select>
        </FormField>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Profil (mm)</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="0"
            max="20"
            step="0.1"
            bind:value={profileMm}
          />
        </label>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">DOT-Jahr</span>
          <input
            class="input input-bordered w-full"
            type="number"
            min="1980"
            max="2100"
            step="1"
            bind:value={dotYear}
          />
        </label>
        <FormField
          label="Stückzahl"
          error={wasTouched('quantity') ? err('quantity') : null}
        >
          <input
            class={validationClasses(err('quantity'), wasTouched('quantity'))}
            type="number"
            min="1"
            max="20"
            step="1"
            bind:value={quantity}
            onblur={() => fv.markTouched('quantity')}
          />
        </FormField>
        <label class="flex w-full flex-col gap-1">
          <span class="label-text">Eingelagert am</span>
          <input
            class="input input-bordered w-full"
            type="date"
            bind:value={storedAt}
          />
        </label>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Fotos</legend>
      <!--
        The whole photo section is the drop zone. `dragover` must
        `preventDefault` so the browser fires `drop`. The dashed
        primary border only flips on while a file drag is in flight.
      -->
      <div
        class="relative rounded transition-colors {dragActive
          ? 'border-primary border-2 border-dashed p-2'
          : ''}"
        ondragenter={onPhotoDragEnter}
        ondragover={onPhotoDragOver}
        ondragleave={onPhotoDragLeave}
        ondrop={onPhotoDrop}
        role="region"
        aria-label="Fotos"
        data-drag-active={dragActive ? 'true' : 'false'}
      >
        {#if dragActive}
          <div
            class="bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded text-sm font-medium opacity-90"
          >
            Dateien hier ablegen
          </div>
        {/if}
        {#if photos.length > 0}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each photos as p (p.id)}
              <div
                class="border-base-300 bg-base-200 overflow-hidden rounded border"
              >
                <div class="bg-base-300 relative aspect-video">
                  <img
                    src={photoSrc(p)}
                    alt="Foto"
                    class="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
                <div class="flex flex-col gap-2 p-2">
                  <input
                    class="input input-bordered input-sm w-full"
                    placeholder="Beschriftung (optional)"
                    maxlength="200"
                    value={p.caption ?? ''}
                    oninput={(e) =>
                      updateCaption(p.id, (e.target as HTMLInputElement).value)}
                  />
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-error gap-1"
                    onclick={() => removePhoto(p.id)}
                    disabled={busy.active}
                  >
                    <Trash2 size={14} />
                    Foto entfernen
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div
            class="border-base-300 bg-base-200 text-base-content/40 flex h-32 flex-col items-center justify-center rounded border text-sm"
          >
            <span>Noch keine Fotos hinterlegt</span>
            <span class="mt-1 text-xs">
              Bilder hierher ziehen oder Datei auswählen
            </span>
          </div>
        {/if}
      </div>
      <div class="mt-2 flex justify-end">
        <input
          bind:this={fileInput}
          type="file"
          class="hidden"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onchange={onFilesPicked}
          disabled={busy.active}
        />
        <button
          type="button"
          class="btn btn-primary btn-sm gap-2"
          onclick={() => fileInput?.click()}
          disabled={busy.active}
        >
          <ImagePlus size={16} />
          Fotos hinzufügen
        </button>
      </div>
    </fieldset>

    <fieldset class="fieldset">
      <legend class="fieldset-legend">Notiz</legend>
      <textarea
        class="textarea textarea-bordered min-h-24 w-full"
        maxlength="2000"
        bind:value={notes}
      ></textarea>
    </fieldset>

    <div class="card-actions justify-end gap-2">
      {#if onCancel}
        <button
          type="button"
          class="btn btn-ghost"
          onclick={onCancel}
          disabled={busy.active}
        >
          Abbrechen
        </button>
      {/if}
      <button
        type="submit"
        class="btn btn-primary"
        disabled={busy.active || !fv.valid}
      >
        {#if busy.active}
          <span class="loading loading-spinner loading-sm"></span>
        {/if}
        Speichern
      </button>
    </div>
  </div>
</form>
