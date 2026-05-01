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
</script>

<div
  class="border-base-300 flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row sm:px-6"
  role="navigation"
  aria-label="Seitennavigation"
>
  <div class="text-base-content/60 text-sm">
    <span class="text-base-content font-medium"
      >{total.toLocaleString('de-DE')}</span
    >
    Treffer · Seite {pageProp} von {Math.max(1, pageCount)}
  </div>

  <div class="join">
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
        <button type="button" class="btn btn-sm join-item btn-disabled"
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
