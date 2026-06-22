<script lang="ts">
  /**
   * Reusable image uploader card.
   *
   * Two modes (driven by `images.length` + `single` prop):
   *
   * - **single**: one image visible at a time. Used for the company
   *   logo in settings — pass `allowDelete={false}` if a placeholder
   *   must always exist (the legal Pflichtangabe on PDFs).
   * - **multi**: gallery view with thumbnails. Used for vehicle photos.
   *   Titelbild image marked with a star; clicking a thumbnail promotes it.
   *
   * The component is presentation-only — it never talks to the backend
   * directly. Callers wire `onUpload`, `onDelete`, `onSetMain` to the
   * appropriate remote function and refresh `images` after the call.
   *
   * Files are read with `FileReader` into base64 data URLs and passed
   * to `onUpload` as-is. The 5 MB ceiling matches the value used in
   * Setup and the Settings logo flow; PNG/JPG/WebP are accepted.
   */
  import { ImagePlus, Star, Trash2 } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'

  type Image = { id: string; dataUrl: string; isMain?: boolean }

  type Props = {
    /** Stored images. Empty array shows the placeholder + uploader. */
    images: Image[]
    /** Title shown in the card header. */
    title?: string
    /** Hint shown under the title (e.g. accepted formats / size). */
    hint?: string
    /** True = single-image mode (logo); false = gallery mode. */
    single?: boolean
    /** Hide the delete button — used for must-keep-one images. */
    allowDelete?: boolean
    /** Hide the set-cover star — only useful in gallery mode. */
    allowSetMain?: boolean
    /** Max size in bytes (20 MB default). */
    maxBytes?: number
    /**
     * Called with `{ mime, dataUrl }` once the user picks a file. The
     * caller persists it and refreshes the `images` array.
     */
    onUpload: (file: { mime: string; dataUrl: string }) => Promise<void>
    /** Called with the image id when the user hits the trash icon. */
    onDelete?: (id: string) => Promise<void>
    /** Gallery only: promote `id` to cover. */
    onSetMain?: (id: string) => Promise<void>
  }

  const {
    images,
    title = 'Bilder',
    hint,
    single = false,
    allowDelete = true,
    allowSetMain = true,
    maxBytes = 20 * 1024 * 1024,
    onUpload,
    onDelete,
    onSetMain
  }: Props = $props()

  let fileInput = $state<HTMLInputElement | null>(null)
  /**
   * `dragActive` flips the dashed-border overlay on while a file is
   * being dragged over the card. `dragDepth` tracks the number of
   * nested dragenter events so that crossing a child boundary does
   * not reset the active flag prematurely.
   */
  let dragActive = $state(false)
  let dragDepth = 0

  const readDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  /**
   * Shared ingestion path for both the `<input type=file>` picker and
   * the drag-and-drop drop handler. Validation (mime + size) is
   * identical in both cases, as are the toast messages.
   */
  const ingest = async (files: File[]) => {
    if (files.length === 0) return
    const mb = Math.round(maxBytes / (1024 * 1024))
    for (const file of files) {
      if (!/^image\//.test(file.type)) {
        toast.error(`„${file.name}" ist keine Bilddatei.`)
        return
      }
      if (file.size > maxBytes) {
        toast.error(`„${file.name}" ist größer als ${mb} MB.`)
        return
      }
    }
    try {
      await busy.run(async () => {
        for (const file of files) {
          const dataUrl = await readDataUrl(file)
          await onUpload({ mime: file.type, dataUrl })
        }
      })
    } catch {
      // Caller is expected to surface errors via handleClientError.
    }
  }

  const onPicked = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    await ingest(files)
    if (fileInput) fileInput.value = ''
  }

  const isFileDrag = (e: DragEvent): boolean => {
    const types = e.dataTransfer?.types
    if (!types) return false
    // DataTransferItemList implements iterable; cast for older typings.
    return Array.from(types as unknown as string[]).includes('Files')
  }

  const onDragEnter = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth += 1
    dragActive = true
  }

  const onDragOver = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    dragActive = true
  }

  const onDragLeave = (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) dragActive = false
  }

  const onDrop = async (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    dragDepth = 0
    dragActive = false
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (single && files.length > 1) {
      await ingest(files.slice(0, 1))
    } else {
      await ingest(files)
    }
  }

  const remove = async (id: string) => {
    if (!onDelete) return
    try {
      await busy.run(() => onDelete(id))
    } catch {
      // Caller surfaces via handleClientError.
    }
  }

  const setMain = async (id: string) => {
    if (!onSetMain) return
    try {
      await busy.run(() => onSetMain(id))
    } catch {
      // Caller surfaces via handleClientError.
    }
  }

  const cover = $derived(
    images.find((i) => i.isMain) ?? (single ? images[0] : null)
  )
</script>

<!--
  The whole card is the drop zone. `dragover` must `preventDefault`
  for the browser to fire `drop`. While a file is dragged over we
  show a dashed primary border + fade overlay; pointer-events stay
  off the overlay so the underlying `drop` handler still receives
  the event.
-->
<div
  class="card border-base-300 bg-base-100 relative border transition-colors {dragActive
    ? 'border-primary border-dashed'
    : ''}"
  ondragenter={onDragEnter}
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
  role="region"
  aria-label={title}
  data-drag-active={dragActive ? 'true' : 'false'}
>
  {#if dragActive}
    <div
      class="bg-primary/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded text-sm font-medium opacity-90"
    >
      Dateien hier ablegen
    </div>
  {/if}
  <div class="card-body gap-3">
    <div>
      <h3 class="card-title text-base">{title}</h3>
      {#if hint}
        <p class="text-base-content/60 text-sm">{hint}</p>
      {/if}
    </div>

    {#if single}
      {#if cover}
        <div
          class="border-base-300 bg-base-200 flex h-40 items-center justify-center rounded p-2"
        >
          <img
            src={cover.dataUrl}
            alt="Vorschau"
            class="max-h-full max-w-full object-contain"
          />
        </div>
      {:else}
        <div
          class="border-base-300 bg-base-200 text-base-content/40 flex h-40 flex-col items-center justify-center rounded border text-sm"
        >
          <span>Kein Bild hinterlegt</span>
          <span class="mt-1 text-xs">
            Bilder hierher ziehen oder Datei auswählen
          </span>
        </div>
      {/if}
    {:else if images.length > 0}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each images as img (img.id)}
          <div
            class="border-base-300 bg-base-200 overflow-hidden rounded border"
          >
            <div class="bg-base-300 relative aspect-video">
              <img
                src={img.dataUrl}
                alt="Foto"
                class="absolute inset-0 h-full w-full object-cover"
              />
              {#if img.isMain}
                <span
                  class="badge badge-warning badge-sm absolute top-2 left-2 gap-1 shadow"
                  title="Titelbild"
                >
                  <Star size={12} /> Titelbild
                </span>
              {/if}
            </div>
            <!--
              Aktionen sind dauerhaft sichtbar — kein hover-only,
              kein separater Bearbeitungsmodus. Auf dem aktuellen
              Titelbild blenden wir den "Als Titelbild"-Button aus,
              damit er sich nicht mit dem Badge oben links doppelt.
            -->
            <div class="border-base-300 flex items-stretch border-t">
              {#if allowSetMain && onSetMain && !img.isMain}
                <button
                  type="button"
                  class="btn btn-ghost btn-sm flex-1 justify-center gap-2 rounded-none"
                  onclick={() => setMain(img.id)}
                  disabled={busy.active}
                  aria-label="Als Titelbild festlegen"
                >
                  <Star size={14} />
                  Als Titelbild festlegen
                </button>
              {/if}
              {#if allowDelete && onDelete}
                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-error flex-1 justify-center gap-2 rounded-none {allowSetMain &&
                  onSetMain &&
                  !img.isMain
                    ? 'border-base-300 border-l'
                    : ''}"
                  onclick={() => remove(img.id)}
                  disabled={busy.active}
                  aria-label="Foto löschen"
                >
                  <Trash2 size={14} />
                  Löschen
                </button>
              {/if}
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

    <!--
      Upload-Bereich: Button rechts, Bestand-Aktion (Bild entfernen)
      links — hält die Karte ruhig. Kein max-MB-Hinweistext.
    -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      {#if single && cover && allowDelete && onDelete}
        <button
          type="button"
          class="btn btn-ghost btn-sm text-error gap-1"
          onclick={() => remove(cover.id)}
          disabled={busy.active}
        >
          <Trash2 size={14} />
          Bild entfernen
        </button>
      {:else}
        <span></span>
      {/if}
      <input
        bind:this={fileInput}
        type="file"
        class="hidden"
        accept="image/png,image/jpeg,image/webp"
        multiple={!single}
        onchange={onPicked}
        disabled={busy.active}
      />
      <button
        type="button"
        class="btn btn-primary btn-sm gap-2"
        onclick={() => fileInput?.click()}
        disabled={busy.active}
      >
        <ImagePlus size={16} />
        {single && cover
          ? 'Bild ersetzen'
          : single
            ? 'Bild hinzufügen'
            : 'Bilder hinzufügen'}
      </button>
    </div>
  </div>
</div>
