<script lang="ts">
  /**
   * In-app PDF preview backed by a remote-function call. We fetch the
   * document's PDF bytes (base64) on demand, turn them into a Blob URL
   * and render them inside an iframe. The iframe uses the browser's
   * built-in PDF viewer — works in Chromium / Firefox / Safari without
   * pulling in `pdfjs-dist` for a few hundred KB of bundle.
   *
   * The component:
   * - Triggers fetch via {@link getDocumentPdfBytesRemote} on mount.
   * - Shows the global busy bar via `busy.run` while the fetch is in
   *   flight, so the AppShell loader is the single signal.
   * - Falls back to a download link if the browser can't embed PDFs
   *   inline (e.g. some mobile browsers).
   * - Cleans up the Blob URL on destroy / when the document changes.
   */
  import { onMount, onDestroy } from 'svelte'
  import { Download, RefreshCcw } from '@lucide/svelte'
  import {
    getDocumentPdfBytesRemote,
    regenerateDocumentPdfRemote
  } from '../../../routes/pdfs.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'

  type Props = {
    documentId: string
    /** Visual height of the embedded viewer. */
    height?: string
  }

  const { documentId, height = '720px' }: Props = $props()

  let blobUrl = $state<string | null>(null)
  let filename = $state('Dokument.pdf')
  let loadError = $state<string | null>(null)

  const decodeBase64 = (b64: string): Uint8Array => {
    const bin = atob(b64)
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    return buf
  }

  const load = async () => {
    loadError = null
    try {
      const res = await busy.run(() =>
        getDocumentPdfBytesRemote({ id: documentId }).run()
      )
      filename = res.filename
      const bytes = decodeBase64(res.base64)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: res.mime })
      // Replace any previous URL.
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      blobUrl = URL.createObjectURL(blob)
    } catch (err) {
      loadError = 'PDF konnte nicht geladen werden.'
      handleClientError(err, 'PDF-Vorschau')
    }
  }

  const regenerate = async () => {
    try {
      await busy.run(() => regenerateDocumentPdfRemote({ id: documentId }))
      toast.success('PDF wurde neu erzeugt.')
      await load()
    } catch (err) {
      handleClientError(err, 'PDF-Neuerzeugung')
    }
  }

  onMount(() => {
    void load()
  })

  onDestroy(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  })
</script>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-3 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="card-title text-base">PDF-Vorschau</h3>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-ghost btn-sm gap-1"
          onclick={regenerate}
          disabled={busy.active}
        >
          <RefreshCcw size={14} /> Neu erzeugen
        </button>
        {#if blobUrl}
          <a
            class="btn btn-primary btn-sm gap-1"
            href={blobUrl}
            download={filename}
          >
            <Download size={14} /> Herunterladen
          </a>
        {/if}
      </div>
    </div>

    {#if loadError}
      <div class="alert alert-error">
        <span>{loadError}</span>
      </div>
    {:else if blobUrl}
      <iframe
        title="PDF-Vorschau"
        src={blobUrl}
        class="border-base-300 w-full rounded-md border"
        style="height: {height};"
      ></iframe>
    {:else}
      <div
        class="border-base-300 bg-base-200/40 text-base-content/60 grid place-items-center rounded-md border text-sm"
        style="height: {height};"
      >
        Vorschau wird geladen …
      </div>
    {/if}
  </div>
</div>
