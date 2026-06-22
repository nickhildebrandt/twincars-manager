<script lang="ts">
  /**
   * In-app PDF preview backed by a remote-function call. We fetch the
   * document's PDF bytes (base64) on demand, turn them into a Blob URL
   * and render them inside an iframe. The iframe uses the browser's
   * built-in PDF viewer — works in Chromium / Firefox / Safari without
   * pulling in `pdfjs-dist` for a few hundred KB of bundle.
   *
   * The browser's native PDF viewer ships its own download / refresh /
   * print toolbar, so we deliberately don't render duplicate buttons in
   * the card chrome — the cache auto-invalidates whenever the document
   * inputs change, and any change to the document re-renders the PDF on
   * the next view.
   *
   * Filename trick: blob URLs don't carry a filename, which means the
   * browser's "download" action falls back to the URL path (e.g. the
   * blob UUID with no extension). Appending `#filename` to the blob URL
   * lets Chromium's viewer pick up the proper `*.pdf` name. Other
   * browsers ignore the fragment, but they fall back to the PDF
   * metadata `/Title` we set during rendering.
   */
  import { onMount, onDestroy } from 'svelte'
  import {
    getDocumentPdfBytesRemote,
    getReminderPdfBytesRemote
  } from '../../../routes/pdfs.remote'
  import { handleClientError } from '$lib/utils/client-error'
  import { busy } from '$lib/stores/busy.svelte'

  type Props = {
    documentId: string
    /**
     * Which cache to fetch from. `document` is the default and covers
     * invoices / offers / cost estimates / order confirmations;
     * `reminder` routes to the dunning cache.
     */
    kind?: 'document' | 'reminder'
    /** Visual height of the embedded viewer. */
    height?: string
  }

  const { documentId, kind = 'document', height = '720px' }: Props = $props()

  const fetchBytes = (id: string) =>
    kind === 'reminder'
      ? getReminderPdfBytesRemote({ id }).run()
      : getDocumentPdfBytesRemote({ id }).run()

  let iframeSrc = $state<string | null>(null)
  let blobUrl: string | null = null
  let loadError = $state<string | null>(null)

  const decodeBase64 = (b64: string): Uint8Array => {
    const bin = atob(b64)
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    return buf
  }

  const ensurePdfExtension = (name: string): string =>
    /\.pdf$/i.test(name) ? name : `${name}.pdf`

  const load = async () => {
    loadError = null
    try {
      const res = await busy.run(() => fetchBytes(documentId))
      const filename = ensurePdfExtension(res.filename)
      const bytes = decodeBase64(res.base64)
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: res.mime })
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      blobUrl = URL.createObjectURL(blob)
      // The fragment is what Chromium's pdf viewer uses as the suggested
      // download filename; everything before it stays the actual blob
      // URL, so the iframe still resolves correctly.
      iframeSrc = `${blobUrl}#${encodeURIComponent(filename)}`
    } catch (err) {
      loadError = 'PDF konnte nicht geladen werden.'
      handleClientError(err, 'PDF-Vorschau')
    }
  }

  onMount(() => {
    // Defer past Svelte's effect flush — `onMount` itself runs inside an
    // effect, and remote `.run()` calls aren't allowed in that context.
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  })

  onDestroy(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
  })
</script>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body gap-3 p-3">
    <h3 class="card-title text-base">PDF-Vorschau</h3>

    {#if loadError}
      <div class="alert alert-error">
        <span>{loadError}</span>
      </div>
    {:else if iframeSrc}
      <iframe
        title="PDF-Vorschau"
        src={iframeSrc}
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
