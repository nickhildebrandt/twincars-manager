<script lang="ts">
  /**
   * Generic Subject / Body / Attachments composer used by both the
   * customer ad-hoc email modal and the broadcast / Newsletter page.
   *
   * The component is layout-only — it doesn't call any remote. The
   * parent owns the send-button label, the recipient surface, and the
   * eventual `*.run(() => sendXRemote(...))` call. We hand it back the
   * current `{ subject, body, attachments }` plus a `reset()` helper
   * via bindable props.
   *
   * Attachments are read with `FileReader.readAsDataURL` so we can
   * ship them as base64 strings the server can decode straight into a
   * `Buffer`. Files larger than the per-file cap (default 10 MB) are
   * rejected on pick with a German toast.
   */
  import { busy } from '$lib/stores/busy.svelte'
  import { toast } from '$lib/stores/toast.svelte'
  import { Paperclip, X } from '@lucide/svelte'

  export type ComposerAttachment = {
    filename: string
    mime: string
    size: number
    base64Data: string
  }

  type Props = {
    subject: string
    body: string
    attachments: ComposerAttachment[]
    /** Per-file ceiling in bytes. */
    maxBytesPerFile?: number
    /** Disable everything (e.g. while the parent is sending). */
    disabled?: boolean
    /** Optional helper text rendered below the body. */
    hint?: string
    /** Show the "Als HTML senden" toggle. */
    allowHtml?: boolean
    /** Two-way: whether the body is treated as HTML source. */
    asHtml?: boolean
  }

  let {
    subject = $bindable(''),
    body = $bindable(''),
    attachments = $bindable<ComposerAttachment[]>([]),
    maxBytesPerFile = 10 * 1024 * 1024,
    disabled = false,
    hint,
    allowHtml = false,
    asHtml = $bindable(false)
  }: Props = $props()

  let fileInput = $state<HTMLInputElement | null>(null)

  const readBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result)
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const onPicked = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return

    const mb = Math.round(maxBytesPerFile / (1024 * 1024))
    const accepted: File[] = []
    for (const file of files) {
      if (file.size > maxBytesPerFile) {
        toast.error(`„${file.name}" ist größer als ${mb} MB.`)
        continue
      }
      accepted.push(file)
    }

    for (const file of accepted) {
      try {
        const base64Data = await readBase64(file)
        attachments = [
          ...attachments,
          {
            filename: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size,
            base64Data
          }
        ]
      } catch {
        toast.error(`„${file.name}" konnte nicht gelesen werden.`)
      }
    }

    if (fileInput) fileInput.value = ''
  }

  const removeAt = (idx: number) => {
    attachments = attachments.filter((_, i) => i !== idx)
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
</script>

<div class="grid gap-3">
  <label class="flex w-full flex-col gap-1">
    <span class="label-text">Betreff</span>
    <input
      class="input input-bordered w-full"
      maxlength="200"
      bind:value={subject}
      disabled={disabled || busy.active}
    />
  </label>

  <label class="flex w-full flex-col gap-1">
    <span class="label-text">Nachricht{asHtml ? ' (HTML-Quelltext)' : ''}</span>
    <textarea
      class="textarea textarea-bordered min-h-40 w-full {asHtml
        ? 'font-mono text-sm'
        : ''}"
      maxlength="50000"
      bind:value={body}
      disabled={disabled || busy.active}
    ></textarea>
    {#if allowHtml}
      <label class="label cursor-pointer justify-start gap-2 py-1">
        <input
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary"
          bind:checked={asHtml}
          disabled={disabled || busy.active}
        />
        <span class="label-text">Als HTML senden</span>
      </label>
      <span class="text-base-content/60 text-xs">
        {#if asHtml}
          Der Nachrichtentext wird als HTML-Quelltext interpretiert. Eine
          Nur-Text-Variante wird automatisch für Clients ohne HTML erzeugt.
        {:else}
          Reiner Text. Aktivieren Sie „Als HTML senden", um HTML-Quelltext zu
          verwenden.
        {/if}
      </span>
    {/if}
    {#if hint}
      <span class="text-base-content/60 text-xs">{hint}</span>
    {/if}
  </label>

  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="label-text">Anhänge</span>
      <button
        type="button"
        class="btn btn-ghost btn-sm gap-2"
        onclick={() => fileInput?.click()}
        disabled={disabled || busy.active}
      >
        <Paperclip size={14} />
        Datei wählen
      </button>
      <input
        bind:this={fileInput}
        type="file"
        class="hidden"
        multiple
        onchange={onPicked}
        disabled={disabled || busy.active}
      />
    </div>
    {#if attachments.length === 0}
      <p class="text-base-content/60 text-xs">
        Keine Anhänge ausgewählt. Maximal 10 MB pro Datei.
      </p>
    {:else}
      <ul class="flex flex-wrap gap-2">
        {#each attachments as att, idx (idx)}
          <li
            class="border-base-300 bg-base-200 flex items-center gap-2 rounded border px-2 py-1 text-xs"
          >
            <span class="max-w-[14rem] truncate" title={att.filename}>
              {att.filename}
            </span>
            <span class="text-base-content/60">
              {formatSize(att.size)}
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onclick={() => removeAt(idx)}
              disabled={disabled || busy.active}
              aria-label="Anhang entfernen"
            >
              <X size={12} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
