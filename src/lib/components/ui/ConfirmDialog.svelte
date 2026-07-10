<script lang="ts">
  import { busy } from '$lib/stores/busy.svelte'

  type Props = {
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'primary'
    onConfirm: () => void | Promise<void>
    onClose: () => void
  }

  let {
    open = $bindable(false),
    title,
    message,
    confirmLabel = 'Bestätigen',
    cancelLabel = 'Abbrechen',
    variant = 'primary',
    onConfirm,
    onClose
  }: Props = $props()

  /**
   * Re-entrancy guard only — deliberately NOT reactive state and NOT a
   * loading indicator. The visible disabled state + button spinner are
   * driven by the global busy store (callers wrap their mutation in
   * `busy.run(...)`), per the single-loading-source rule.
   */
  let inFlight = false

  let dialogEl = $state<HTMLDialogElement | null>(null)

  /**
   * Native modal semantics: `showModal()` traps Tab inside the dialog,
   * lets Esc fire the `cancel` event and restores focus to the
   * triggering element on `close()`. Optional chaining keeps test
   * environments without a full `<dialog>` implementation working; the
   * `modal-open` class remains the visual fallback there.
   */
  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      dialogEl.showModal?.()
    }
  })

  /** Close natively first so the browser restores focus to the trigger. */
  const closeDialog = () => {
    dialogEl?.close?.()
    open = false
    onClose()
  }

  const handleConfirm = async () => {
    if (inFlight) return
    inFlight = true
    try {
      await onConfirm()
      closeDialog()
    } catch (err) {
      // A rejecting onConfirm keeps the dialog open so the user can
      // retry or cancel. Callers already surface their own curated
      // German toasts — log for developers only, never re-throw
      // (an unhandled rejection would escape the click handler).
      console.error('[ConfirmDialog] onConfirm rejected:', err)
    } finally {
      inFlight = false
    }
  }

  const handleCancel = () => {
    closeDialog()
  }

  /** Esc inside the native modal — route through the cancel path. */
  const handleNativeCancel = (e: Event) => {
    e.preventDefault()
    handleCancel()
  }
</script>

{#if open}
  <dialog
    bind:this={dialogEl}
    class="modal modal-open"
    oncancel={handleNativeCancel}
  >
    <div class="modal-box">
      <h3 class="text-lg font-semibold">{title}</h3>
      {#if message}
        <p class="text-base-content/80 py-3 text-sm">{message}</p>
      {/if}
      <div class="modal-action">
        <button
          class="btn btn-ghost"
          onclick={handleCancel}
          disabled={busy.active}
        >
          {cancelLabel}
        </button>
        <button
          class="btn"
          class:btn-error={variant === 'danger'}
          class:btn-primary={variant === 'primary'}
          onclick={handleConfirm}
          disabled={busy.active}
        >
          {#if busy.active}<span class="loading loading-spinner loading-sm"
            ></span>{/if}
          {confirmLabel}
        </button>
      </div>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Schließen"
      onclick={handleCancel}
    ></button>
  </dialog>
{/if}
