<script lang="ts">
  /**
   * Standard loader component.
   *
   * Variants:
   * - `block` (default): centered spinner + label, intended for inline use
   *   inside a card or section.
   * - `inline`: small spinner + label rendered inline-flex.
   * - `overlay`: absolute-positioned full-area cover with a translucent
   *   background and a centered spinner; sits inside a `relative` parent
   *   (typically the AppShell main slot) to lock the content area while a
   *   transition is in flight.
   *
   * Note: there is no `bar` variant here on purpose. The single global
   *       loading bar lives inside `AppShell`'s sticky header — no other
   *       component is allowed to render its own progress bar.
   *
   * All styling is DaisyUI / Tailwind only — no custom CSS.
   */
  type Props = {
    size?: 'sm' | 'md' | 'lg'
    label?: string
    variant?: 'block' | 'inline' | 'overlay'
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
{:else if variant === 'overlay'}
  <div
    class="bg-base-100/70 absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span class="loading loading-spinner loading-lg text-primary"></span>
    <span class="text-base-content/70 text-sm">{label}</span>
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
