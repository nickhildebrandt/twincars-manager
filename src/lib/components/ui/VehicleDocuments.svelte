<script lang="ts">
  /**
   * Vehicle documents card — upload / list / view / delete for the
   * file attachments of a single vehicle (Fahrzeugbrief scan, purchase
   * contract, HU report, ...). Rendered on the vehicle detail page for
   * customer AND stock vehicles alike.
   *
   * Bytes rule (mirrors the PDF section): the list only ever carries
   * metadata; the actual bytes travel exclusively through
   * `getVehicleDocumentRemote` when the user hits "Anzeigen". Viewing
   * opens a `blob:` URL in a new tab — the browser's built-in viewers
   * handle both PDFs and images (same approach as `openPdfInNewTab`);
   * the `#filename` fragment gives Chromium's PDF viewer a proper
   * download name.
   *
   * Client-side pre-checks (mime allowlist + 15 MB) duplicate the
   * server rules so oversized or unsupported files never leave the
   * browser; the server remains the authority.
   */
  import { untrack } from 'svelte'
  import { Eye, FileText, Trash2, Upload } from '@lucide/svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'
  import { base64ToBytes } from '$lib/utils/pdf-download'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import EmptyState from './EmptyState.svelte'
  import {
    deleteVehicleDocumentRemote,
    getVehicleDocumentRemote,
    listVehicleDocumentsRemote,
    uploadVehicleDocumentRemote
  } from '../../../routes/vehicles/vehicle-documents.remote'

  /** Meta row as returned by `listVehicleDocumentsRemote`. */
  export type VehicleDocumentItem = {
    id: string
    fileName: string
    mime: string
    sizeBytes: number
    note: string | null
    uploadedAt: Date | string
  }

  type Props = {
    vehicleId: string
    /** Initial document list — the host page awaits the list remote. */
    initial: VehicleDocumentItem[]
  }

  const { vehicleId, initial }: Props = $props()

  /** Client-side mirror of the server allowlist (server stays authoritative). */
  const ALLOWED_MIMES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ] as const
  type AllowedMime = (typeof ALLOWED_MIMES)[number]

  /** Fallback for browsers that report an empty `File.type`. */
  const EXTENSION_MIMES: Record<string, AllowedMime> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp'
  }

  /** 15 MB — mirrors MAX_VEHICLE_DOCUMENT_BYTES on the server. */
  const MAX_BYTES = 15 * 1024 * 1024

  /** Milliseconds before the viewer blob URL is revoked. */
  const REVOKE_DELAY_MS = 60_000

  // Deliberate snapshot: `initial` seeds the list once, refreshes are
  // fetched imperatively after every mutation.
  let docs = $state<VehicleDocumentItem[]>(untrack(() => initial))
  let note = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)
  let pendingDelete = $state<VehicleDocumentItem | null>(null)
  let confirmOpen = $state(false)

  const refresh = async () => {
    docs = await listVehicleDocumentsRemote({ vehicleId }).run()
  }

  const resolveMime = (file: File): AllowedMime | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const candidate = file.type || EXTENSION_MIMES[ext] || ''
    return (ALLOWED_MIMES as readonly string[]).includes(candidate)
      ? (candidate as AllowedMime)
      : null
  }

  /** Raw base64 (no data-URL prefix), as the upload remote expects it. */
  const readBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const formatSize = (bytes: number): string =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toLocaleString('de-DE', {
          maximumFractionDigits: 1
        })} MB`
      : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-DE')} KB`

  const fmtDate = (d: Date | string): string => {
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const onPicked = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const mime = resolveMime(file)
    if (!mime) {
      toast.error(
        `„${file.name}" wird nicht unterstützt. Erlaubt sind PDF, JPEG, PNG und WebP.`
      )
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(`„${file.name}" ist größer als 15 MB.`)
      return
    }
    try {
      await busy.run(async () => {
        const dataBase64 = await readBase64(file)
        await uploadVehicleDocumentRemote({
          vehicleId,
          fileName: file.name,
          mime,
          dataBase64,
          note: note.trim() || undefined
        })
        await refresh()
      })
      note = ''
      toast.success('Dokument hochgeladen.')
    } catch (err) {
      handleClientError(err, 'Dokument konnte nicht hochgeladen werden')
    }
  }

  const view = async (doc: VehicleDocumentItem) => {
    try {
      const res = await busy.run(() =>
        getVehicleDocumentRemote({ id: doc.id }).run()
      )
      const bytes = base64ToBytes(res.dataBase64)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: res.mime })
      const url = URL.createObjectURL(blob)
      window.open(
        `${url}#${encodeURIComponent(res.fileName)}`,
        '_blank',
        'noopener'
      )
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
    } catch (err) {
      handleClientError(err, 'Dokument konnte nicht geöffnet werden')
    }
  }

  const askDelete = (doc: VehicleDocumentItem) => {
    pendingDelete = doc
    confirmOpen = true
  }

  const confirmDelete = async () => {
    const doc = pendingDelete
    if (!doc) return
    try {
      await busy.run(async () => {
        await deleteVehicleDocumentRemote({ id: doc.id, vehicleId })
        await refresh()
      })
      toast.success('Dokument gelöscht.')
    } catch (err) {
      handleClientError(err, 'Dokument konnte nicht gelöscht werden')
    }
  }
</script>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-3">
    <div>
      <h3 class="card-title text-base">Dokumente</h3>
      <p class="text-base-content/60 text-sm">
        Fahrzeugpapiere, Kaufverträge, HU-Berichte - als PDF oder Bild, bis 15
        MB.
      </p>
    </div>

    {#if docs.length === 0}
      <EmptyState
        icon={FileText}
        title="Keine Dokumente vorhanden"
        description="Laden Sie das erste Dokument über den Button unten hoch."
      />
    {:else}
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Größe</th>
              <th>Datum</th>
              <th>Notiz</th>
              <th class="text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {#each docs as doc (doc.id)}
              <tr>
                <td class="break-all">{doc.fileName}</td>
                <td class="whitespace-nowrap">{formatSize(doc.sizeBytes)}</td>
                <td class="whitespace-nowrap">{fmtDate(doc.uploadedAt)}</td>
                <td class="break-words">{doc.note ?? '-'}</td>
                <td class="text-right whitespace-nowrap">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm gap-1"
                    onclick={() => view(doc)}
                    disabled={busy.active}
                  >
                    <Eye size={14} />
                    Anzeigen
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-error gap-1"
                    onclick={() => askDelete(doc)}
                    disabled={busy.active}
                  >
                    <Trash2 size={14} />
                    Löschen
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div class="flex flex-wrap items-center justify-end gap-2">
      <input
        class="input input-bordered input-sm w-full sm:w-64"
        maxlength="500"
        placeholder="Notiz zum Upload (optional)"
        bind:value={note}
        disabled={busy.active}
      />
      <input
        bind:this={fileInput}
        type="file"
        class="hidden"
        accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
        onchange={onPicked}
        disabled={busy.active}
      />
      <button
        type="button"
        class="btn btn-primary btn-sm gap-2"
        onclick={() => fileInput?.click()}
        disabled={busy.active}
      >
        <Upload size={16} />
        Dokument hochladen
      </button>
    </div>
  </div>
</div>

{#if pendingDelete}
  <ConfirmDialog
    bind:open={confirmOpen}
    title="Dokument löschen"
    message={`Möchten Sie „${pendingDelete.fileName}" wirklich löschen?`}
    confirmLabel="Endgültig löschen"
    variant="danger"
    onConfirm={confirmDelete}
    onClose={() => (pendingDelete = null)}
  />
{/if}
