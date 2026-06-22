<script lang="ts">
  import { untrack } from 'svelte'
  import { page } from '$app/state'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import Pagination from '$lib/components/ui/Pagination.svelte'
  import ImageUploader from '$lib/components/ui/ImageUploader.svelte'
  import { Pencil } from '@lucide/svelte'
  import {
    addTirePhotoRemote,
    deleteTirePhotoRemote,
    getTirePriceHistoryRemote,
    getTireRemote,
    listTirePhotosRemote,
    setMainTirePhotoRemote
  } from '../tires.remote'
  import { formatEuro } from '$lib/utils/money'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { handleClientError } from '$lib/utils/client-error'

  const id = untrack(() => page.params.id!)

  /** Top-level await: SSR carries the data, hydration reuses the cache. */
  const t = await getTireRemote({ id })
  const initialPhotos = await listTirePhotosRemote({ tireId: id })

  let pageNum = $state(1)
  const size = 25

  const historyQ = $derived(
    getTirePriceHistoryRemote({ id, page: pageNum, size })
  )
  const initialHistory = await untrack(() => historyQ)
  let lastResult = $state<typeof initialHistory>(initialHistory)
  $effect(() => {
    if (historyQ.current) lastResult = historyQ.current
  })
  const history = $derived(historyQ.current ?? lastResult)

  const photoQ = $derived(listTirePhotosRemote({ tireId: id }))
  let lastPhotos = $state(initialPhotos)
  $effect(() => {
    if (photoQ.current) lastPhotos = photoQ.current
  })
  const photos = $derived(photoQ.current ?? lastPhotos)

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return ''
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const sizeLabel = `${t.width}/${t.aspectRatio}${t.construction}${t.diameterInch}`

  /**
   * Adapter for `ImageUploader.onUpload`. The component emits a raw
   * data URL prefixed with `data:<mime>;base64,…` — we strip the
   * prefix so the row stores plain base64.
   */
  const onUpload = async (file: { mime: string; dataUrl: string }) => {
    try {
      await busy.run(() =>
        addTirePhotoRemote({ tireId: id, mime: file.mime, data: file.dataUrl })
      )
      toast.success('Foto hinzugefügt.')
    } catch (err) {
      handleClientError(err, 'Foto konnte nicht hinzugefügt werden')
    }
  }

  const onDelete = async (photoId: string) => {
    try {
      await busy.run(() => deleteTirePhotoRemote({ id: photoId, tireId: id }))
      toast.success('Foto gelöscht.')
    } catch (err) {
      handleClientError(err)
    }
  }

  const onSetMain = async (photoId: string) => {
    try {
      await busy.run(() => setMainTirePhotoRemote({ id: photoId, tireId: id }))
    } catch (err) {
      handleClientError(err)
    }
  }
</script>

<PageHeader
  title="{t.brand} {t.model}"
  subtitle="{sizeLabel} · {t.season}"
  back="/tires"
  primaryAction={{
    label: 'Bearbeiten',
    href: `/tires/${t.id}/edit`,
    icon: Pencil
  }}
/>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
  <div class="card border-base-300 bg-base-100 min-w-0 border lg:col-span-2">
    <div class="card-body">
      <h3 class="card-title text-base">Artikelnummer</h3>
      <p class="font-mono text-lg break-all">{t.articleNumber}</p>
      {#if t.legacyArticleNumber}
        <p class="text-base-content/60 text-sm">
          Alte Art-Nr.: <span class="font-mono">{t.legacyArticleNumber}</span>
        </p>
      {/if}
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Größe & Index</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Größe</dt>
        <dd class="font-mono sm:col-span-2">{sizeLabel}</dd>
        <dt class="text-base-content/60">Lastindex</dt>
        <dd class="sm:col-span-2">{t.loadIndex ?? '—'}</dd>
        <dt class="text-base-content/60">Geschwindigkeitsindex</dt>
        <dd class="sm:col-span-2">{t.speedIndex ?? '—'}</dd>
        <dt class="text-base-content/60">EAN</dt>
        <dd class="font-mono sm:col-span-2">{t.ean ?? '—'}</dd>
        <dt class="text-base-content/60">Hersteller-Art-Nr.</dt>
        <dd class="font-mono sm:col-span-2"
          >{t.manufacturerPartNumber ?? '—'}</dd
        >
      </dl>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">EU-Reifenlabel</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">Kraftstoffeffizienz</dt>
        <dd class="sm:col-span-2">{t.fuelEfficiency ?? '—'}</dd>
        <dt class="text-base-content/60">Nasshaftung</dt>
        <dd class="sm:col-span-2">{t.wetGrip ?? '—'}</dd>
        <dt class="text-base-content/60">Geräuschklasse</dt>
        <dd class="sm:col-span-2">{t.noiseClass ?? '—'}</dd>
        <dt class="text-base-content/60">Geräuschwert</dt>
        <dd class="sm:col-span-2"
          >{t.noiseDb != null ? `${t.noiseDb} dB` : '—'}</dd
        >
      </dl>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Eigenschaften</h3>
      <ul class="flex flex-wrap gap-1.5 text-xs">
        {#if t.runFlat}<li class="badge badge-ghost badge-sm">Run-Flat</li>{/if}
        {#if t.reinforced}<li class="badge badge-ghost badge-sm">XL / RF</li
          >{/if}
        {#if t.mSMarking}<li class="badge badge-ghost badge-sm">M+S</li>{/if}
        {#if t.snowFlake}<li class="badge badge-ghost badge-sm">3PMSF</li>{/if}
        {#if t.studdedWinter}<li class="badge badge-ghost badge-sm">Spikes</li
          >{/if}
        {#if t.evCertified}<li class="badge badge-ghost badge-sm">EV</li>{/if}
        {#if !t.runFlat && !t.reinforced && !t.mSMarking && !t.snowFlake && !t.studdedWinter && !t.evCertified}
          <li class="text-base-content/60">Keine Sondereigenschaften.</li>
        {/if}
      </ul>
    </div>
  </div>

  <div class="card border-base-300 bg-base-100 min-w-0 border">
    <div class="card-body">
      <h3 class="card-title text-base">Preise & Lager</h3>
      <dl class="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
        <dt class="text-base-content/60">VK netto</dt>
        <dd class="font-mono sm:col-span-2"
          >{formatEuro(Number(t.unitPriceNet ?? 0))}</dd
        >
        <dt class="text-base-content/60">EK netto</dt>
        <dd class="font-mono sm:col-span-2"
          >{t.purchasePriceNet
            ? formatEuro(Number(t.purchasePriceNet))
            : '—'}</dd
        >
        <dt class="text-base-content/60">Bestand</dt>
        <dd class="sm:col-span-2">{t.stockOnHand}</dd>
        <dt class="text-base-content/60">Online verkaufbar</dt>
        <dd class="sm:col-span-2">{t.onlineSellable ? 'Ja' : 'Nein'}</dd>
      </dl>
    </div>
  </div>

  {#if t.description}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Beschreibung</h3>
        <p class="text-sm whitespace-pre-line">{t.description}</p>
      </div>
    </div>
  {/if}
  {#if t.notes}
    <div class="card border-base-300 bg-base-100 border lg:col-span-2">
      <div class="card-body">
        <h3 class="card-title text-base">Notiz</h3>
        <p class="text-sm whitespace-pre-line">{t.notes}</p>
      </div>
    </div>
  {/if}

  <div class="lg:col-span-2">
    <ImageUploader
      title="Galerie"
      hint="Bilder per Drag&Drop hochladen — bis 8 MB pro Foto."
      images={photos.map((p) => ({
        id: p.id,
        dataUrl: p.data.startsWith('data:')
          ? p.data
          : `data:${p.mime};base64,${p.data}`,
        isMain: p.isMain
      }))}
      {onUpload}
      {onDelete}
      {onSetMain}
    />
  </div>

  <div class="card border-base-300 bg-base-100 border lg:col-span-2">
    <div class="card-body p-0">
      <div class="p-4 pb-2">
        <h3 class="card-title text-base">Preisverlauf</h3>
        <p class="text-base-content/60 text-sm">
          Versionierte Stammpreise — Belegpositionen behalten ihren damals
          verwendeten Preis unabhängig davon.
        </p>
      </div>
      {#if history.items.length > 0}
        <div class="overflow-x-auto">
          <table class="table-sm table">
            <thead>
              <tr>
                <th>Gültig ab</th>
                <th class="text-right">Einzelpreis netto</th>
                <th>Erfasst</th>
              </tr>
            </thead>
            <tbody>
              {#each history.items as row (row.id)}
                <tr>
                  <td>{fmtDate(row.validFrom)}</td>
                  <td class="text-right font-mono"
                    >{formatEuro(Number(row.unitPriceNet))}</td
                  >
                  <td class="text-base-content/60">
                    {fmtDate(
                      typeof row.createdAt === 'string'
                        ? row.createdAt
                        : row.createdAt.toISOString()
                    )}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <Pagination
          page={history.page}
          pageCount={history.pageCount}
          total={history.total}
          onPage={(p) => (pageNum = p)}
        />
      {:else}
        <p class="text-base-content/60 px-4 pb-4 text-sm">
          Noch keine Preisversionen erfasst.
        </p>
      {/if}
    </div>
  </div>
</div>
