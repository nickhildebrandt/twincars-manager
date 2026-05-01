<script lang="ts">
  type Props = {
    size?: 'sm' | 'md' | 'lg'
    label?: string
    variant?: 'block' | 'inline' | 'bar'
  }

  const {
    size = 'md',
    label = 'Inhalte werden geladen',
    variant = 'block'
  }: Props = $props()

  const spinnerClass = $derived(
    size === 'sm' ? 'loading-sm' : size === 'lg' ? 'loading-lg' : 'loading-md'
  )
</script>

{#if variant === 'inline'}
  <span class="text-base-content/60 inline-flex items-center gap-2 text-sm">
    <span class="loading loading-spinner {spinnerClass}"></span>
    <span>{label}</span>
  </span>
{:else if variant === 'bar'}
  <div
    class="bg-base-200 relative h-0.5 overflow-hidden"
    role="status"
    aria-live="polite"
    aria-label={label}
  >
    <div
      class="bg-primary absolute inset-y-0 w-1/3 animate-[loader-bar_1.2s_ease-in-out_infinite]"
    ></div>
  </div>
{:else}
  <div
    class="text-base-content/60 flex h-32 flex-col items-center justify-center gap-2"
    role="status"
    aria-live="polite"
  >
    <span class="loading loading-spinner {spinnerClass}"></span>
    <span class="text-sm">{label}</span>
  </div>
{/if}

<style>
  @keyframes loader-bar {
    0% {
      left: -33%;
    }
    100% {
      left: 100%;
    }
  }
</style>
