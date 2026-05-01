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
    size: number
    onPage: (page: number) => void
    onSize?: (size: number) => void
  }

  const {
    page: pageProp,
    pageCount,
    total,
    size,
    onPage,
    onSize
  }: Props = $props()

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

  <div class="flex items-center gap-3">
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

    {#if onSize}
      <select
        class="select select-sm select-bordered"
        value={size}
        onchange={(e) => onSize(Number((e.target as HTMLSelectElement).value))}
        aria-label="Seitengröße"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
        <option value={100}>100</option>
      </select>
    {/if}
  </div>
</div>
