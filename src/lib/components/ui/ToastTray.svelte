<script lang="ts">
  import {
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    Info,
    X
  } from '@lucide/svelte'
  import { toast } from '$lib/stores/toast.svelte'

  const iconFor = (variant: string) => {
    if (variant === 'success') return CheckCircle2
    if (variant === 'warning') return AlertTriangle
    if (variant === 'error') return AlertCircle
    return Info
  }

  const t = $derived(toast.current)
  const Icon = $derived(t ? iconFor(t.variant) : Info)
</script>

{#if t}
  <div class="toast toast-top toast-end z-[60] pe-4 pt-4">
    <div
      role="status"
      aria-live="polite"
      class="alert max-w-md min-w-[20rem] shadow-lg"
      class:alert-success={t.variant === 'success'}
      class:alert-warning={t.variant === 'warning'}
      class:alert-error={t.variant === 'error'}
      class:alert-info={t.variant === 'info'}
      data-toast-id={t.id}
    >
      <Icon size={18} />
      <span class="text-sm">{t.message}</span>
      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs"
        aria-label="Benachrichtigung schließen"
        onclick={() => toast.dismiss()}
      >
        <X size={14} />
      </button>
    </div>
  </div>
{/if}
