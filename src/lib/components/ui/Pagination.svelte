<script lang="ts">
  import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight
  } from '@lucide/svelte'
  import { paginationButtons } from '$lib/utils/pagination'

  type Props = {
    page: number
    pageCount: number
    total: number
    // `size` is accepted for compatibility but page size is fixed at 25 app-wide.
    size?: number
    onPage: (page: number) => void
    // `onSize` is intentionally ignored — page size is fixed.
    onSize?: (size: number) => void
  }

  const { page: pageProp, pageCount, total, onPage }: Props = $props()

  const buttons = $derived(paginationButtons(pageProp, pageCount, 5))
  // Phone variant: smaller numeric window, no first/last chevrons.
  const compactButtons = $derived(paginationButtons(pageProp, pageCount, 3))
</script>

<div
  class="border-base-300 flex flex-col items-center justify-between gap-3 border-t p-3 sm:flex-row sm:p-4"
  role="navigation"
  aria-label="Seitennavigation"
>
  <div class="text-base-content/60 text-sm">
    <span class="text-base-content font-medium"
      >{total.toLocaleString('de-DE')}</span
    >
    Treffer · Seite {pageProp} von {Math.max(1, pageCount)}
  </div>

  <!--
    Phone join (< sm): prev / small numeric window / next. A separate
    element instead of hiding buttons inside the full join, because
    DaisyUI's join rounding targets :first-child/:last-child — hidden
    edge buttons would leave the visible ones square-cornered.
  -->
  <div class="join max-w-full sm:hidden" data-testid="pagination-compact">
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp <= 1}
      onclick={() => onPage(pageProp - 1)}
      aria-label="Vorherige Seite"
    >
      <ChevronLeft size={16} />
    </button>
    {#each compactButtons as btn, i (i)}
      {#if btn === null}
        <!-- Real `disabled` on top of the visual class keeps the inert
             ellipsis out of the keyboard tab order (a11y). -->
        <button type="button" class="btn btn-sm join-item btn-disabled" disabled
          >…</button
        >
      {:else}
        <button
          type="button"
          class="btn btn-sm join-item"
          class:btn-primary={btn === pageProp}
          onclick={() => onPage(btn)}
          aria-current={btn === pageProp ? 'page' : undefined}
        >
          {btn}
        </button>
      {/if}
    {/each}
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp >= pageCount}
      onclick={() => onPage(pageProp + 1)}
      aria-label="Nächste Seite"
    >
      <ChevronRight size={16} />
    </button>
  </div>

  <!-- Full join (sm and up) incl. first/last chevrons. -->
  <div class="join hidden max-w-full sm:flex" data-testid="pagination-full">
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp <= 1}
      onclick={() => onPage(1)}
      aria-label="Erste Seite"
    >
      <ChevronsLeft size={16} />
    </button>
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp <= 1}
      onclick={() => onPage(pageProp - 1)}
      aria-label="Vorherige Seite"
    >
      <ChevronLeft size={16} />
    </button>
    {#each buttons as btn, i (i)}
      {#if btn === null}
        <!-- Real `disabled` on top of the visual class keeps the inert
             ellipsis out of the keyboard tab order (a11y). -->
        <button type="button" class="btn btn-sm join-item btn-disabled" disabled
          >…</button
        >
      {:else}
        <button
          type="button"
          class="btn btn-sm join-item"
          class:btn-primary={btn === pageProp}
          onclick={() => onPage(btn)}
          aria-current={btn === pageProp ? 'page' : undefined}
        >
          {btn}
        </button>
      {/if}
    {/each}
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp >= pageCount}
      onclick={() => onPage(pageProp + 1)}
      aria-label="Nächste Seite"
    >
      <ChevronRight size={16} />
    </button>
    <button
      type="button"
      class="btn btn-sm join-item"
      disabled={pageProp >= pageCount}
      onclick={() => onPage(pageCount)}
      aria-label="Letzte Seite"
    >
      <ChevronsRight size={16} />
    </button>
  </div>
</div>
