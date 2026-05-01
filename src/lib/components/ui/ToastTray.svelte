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
</script>

<div class="toast toast-top toast-end z-50">
  {#each toast.toasts as t (t.id)}
    {@const Icon = iconFor(t.variant)}
    <div
      class="alert"
      class:alert-success={t.variant === 'success'}
      class:alert-warning={t.variant === 'warning'}
      class:alert-error={t.variant === 'error'}
      class:alert-info={t.variant === 'info'}
      role="status"
    >
      <Icon size={18} />
      <span>{t.message}</span>
      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label="Schließen"
        onclick={() => toast.dismiss(t.id)}
      >
        <X size={14} />
      </button>
    </div>
  {/each}
</div>
