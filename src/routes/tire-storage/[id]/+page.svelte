<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte'
  import { Pencil, CheckCircle2, Trash2, QrCode } from '@lucide/svelte'
  import {
    deleteTireStorageRemote,
    getTireStorageRemote,
    markRetrievedRemote
  } from '../tire-storage.remote'
  import { getTireStorageLabelPdfRemote } from '../labels.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { toast } from '$lib/stores/toast.svelte'
  import { busy } from '$lib/stores/busy.svelte'
  import { openPdfInNewTab } from '$lib/utils/pdf-download'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const entry = await getTireStorageRemote({ id })

  let confirmRetrieve = $state(false)
  let confirmDelete = $state(false)

  const seasonLabel = (season: string | null): string => {
    if (season === 'summer') return 'Sommer'
    if (season === 'winter') return 'Winter'
    if (season === 'allseason') return 'Ganzjahr'
    return '—'
  }

  const seasonBadge = (season: string | null): string => {
    if (season === 'summer') return 'badge-warning'
    if (season === 'winter') return 'badge-info'
    if (season === 'allseason') return 'badge-success'
    return 'badge-ghost'
  }

  const photoSrc = (p: {
    mime: string
    data: string
    caption?: string
  }): string =>
    p.data.startsWith('data:') ? p.data : `data:${p.mime};base64,${p.data}`

  const performRetrieve = async () => {
    try {
      await busy.run(() => markRetrievedRemote({ id }))
      toast.success('Als abgeholt markiert.')
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht aktualisiert werden')
    }
  }

  const performDelete = async () => {
    try {
      await busy.run(() => deleteTireStorageRemote({ id }))
      toast.success('Eintrag gelöscht.')
      goto('/tire-storage')
    } catch (err) {
      handleClientError(err, 'Eintrag konnte nicht gelöscht werden')
    }
  }

  /**
   * Fetch the QR-Etikett-PDF and open it in a new tab as a `blob:`
   * URL. The QR payload is the bare storage number, so a workshop
   * scanner reads something useful even offline.
   */
  const printLabel = async () => {
    try {
      const res = await busy.run(() =>
        getTireStorageLabelPdfRemote({ id }).run()
      )
      openPdfInNewTab(res)
    } catch (err) {
      handleClientError(err, 'QR-Etikett konnte nicht erzeugt werden')
    }
  }
</script>

<PageHeader
  title={entry.storageNumber}
  back="/tire-storage"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/tire-storage/${entry.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Stammdaten</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Lagernummer</dt>
        <dd class="font-mono break-all sm:col-span-2">{entry.storageNumber}</dd>
        <dt class="text-base-content/60">Kunde</dt>
        <dd class="break-words sm:col-span-2">{entry.customerLabel}</dd>
        <dt class="text-base-content/60">Kundennr.</dt>
        <dd class="font-mono text-xs break-all sm:col-span-2"
          >{entry.customerNumber}</dd
        >
        <dt class="text-base-content/60">Marke / Modell</dt>
        <dd class="break-words sm:col-span-2"
          >{[entry.brand, entry.model].filter(Boolean).join(' ') || '—'}</dd
        >
        <dt class="text-base-content/60">Reifengröße</dt>
        <dd class="break-words sm:col-span-2">{entry.size ?? '—'}</dd>
        <dt class="text-base-content/60">Profil</dt>
        <dd class="sm:col-span-2"
          >{entry.profileMm != null
            ? `${Number(entry.profileMm).toFixed(1)} mm`
            : '—'}</dd
        >
        <dt class="text-base-content/60">DOT-Jahr</dt>
        <dd class="sm:col-span-2">{entry.dotYear ?? '—'}</dd>
        <dt class="text-base-content/60">Saison</dt>
        <dd class="sm:col-span-2">
          <span class="badge badge-sm {seasonBadge(entry.season)}">
            {seasonLabel(entry.season)}
          </span>
        </dd>
        <dt class="text-base-content/60">Stückzahl</dt>
        <dd class="sm:col-span-2">{entry.quantity}</dd>
      </dl>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Lagerstatus</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Eingelagert</dt>
        <dd class="sm:col-span-2">{entry.storedAt}</dd>
        <dt class="text-base-content/60">Status</dt>
        <dd class="sm:col-span-2">
          {#if entry.retrievedAt}
            <span class="badge badge-sm badge-ghost">
              Abgeholt am {entry.retrievedAt}
            </span>
          {:else}
            <span class="badge badge-sm badge-success">Aktiv eingelagert</span>
          {/if}
        </dd>
      </dl>
      <div class="card-actions mt-4 flex-wrap justify-end gap-2">
        <button
          type="button"
          class="btn btn-sm btn-outline gap-2"
          disabled={busy.active}
          onclick={printLabel}
        >
          <QrCode size={16} />
          QR-Etikett drucken
        </button>
        {#if !entry.retrievedAt}
          <button
            type="button"
            class="btn btn-sm btn-primary gap-2"
            disabled={busy.active}
            onclick={() => (confirmRetrieve = true)}
          >
            <CheckCircle2 size={16} />
            Als abgeholt markieren
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-sm btn-ghost text-error gap-2"
          disabled={busy.active}
          onclick={() => (confirmDelete = true)}
        >
          <Trash2 size={16} />
          Löschen
        </button>
      </div>
    </div>
  </div>

  {#if entry.notes}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Notiz</h3>
        <p class="text-sm whitespace-pre-line">{entry.notes}</p>
      </div>
    </div>
  {/if}

  {#if entry.photos.length > 0}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Fotos</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each entry.photos as p, i (i)}
            <div
              class="border-base-300 bg-base-200 overflow-hidden rounded border"
            >
              <div class="bg-base-300 relative aspect-video">
                <img
                  src={photoSrc(p)}
                  alt={p.caption ?? `Foto ${i + 1}`}
                  class="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              {#if p.caption}
                <div class="text-base-content/70 px-2 py-2 text-xs">
                  {p.caption}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmRetrieve}
  title="Als abgeholt markieren?"
  message={`Soll der Eintrag „${entry.storageNumber}" als abgeholt markiert werden? Heutiges Datum wird verwendet.`}
  confirmLabel="Markieren"
  variant="primary"
  onConfirm={performRetrieve}
  onClose={() => (confirmRetrieve = false)}
/>

<ConfirmDialog
  bind:open={confirmDelete}
  title="Eintrag löschen?"
  message={`Soll der Eintrag „${entry.storageNumber}" wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden.`}
  confirmLabel="Löschen"
  variant="danger"
  onConfirm={performDelete}
  onClose={() => (confirmDelete = false)}
/>
