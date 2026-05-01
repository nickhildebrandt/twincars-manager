<script lang="ts">
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

  let busy = $state(false)

  const handleConfirm = async () => {
    busy = true
    try {
      await onConfirm()
      open = false
      onClose()
    } finally {
      busy = false
    }
  }

  const handleCancel = () => {
    open = false
    onClose()
  }
</script>

{#if open}
  <dialog class="modal modal-open">
    <div class="modal-box">
      <h3 class="text-lg font-semibold">{title}</h3>
      {#if message}
        <p class="text-base-content/80 py-3 text-sm">{message}</p>
      {/if}
      <div class="modal-action">
        <button class="btn btn-ghost" onclick={handleCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          class="btn"
          class:btn-error={variant === 'danger'}
          class:btn-primary={variant === 'primary'}
          onclick={handleConfirm}
          disabled={busy}
        >
          {#if busy}<span class="loading loading-spinner loading-sm"
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
