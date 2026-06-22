<script lang="ts">
  import { goto } from '$app/navigation'
  import { Search, X, Users, Car, Package, FileText } from '@lucide/svelte'
  import { globalSearchRemote } from '../../../routes/search.remote'
  import type { SearchHit } from '$lib/server/services/search-service'

  type Bucket = {
    key: 'customers' | 'vehicles' | 'items' | 'documents'
    label: string
    icon: typeof Search
    items: SearchHit[]
  }

  type Props = { open: boolean }

  let { open = $bindable(false) }: Props = $props()

  let q = $state('')
  let input = $state<HTMLInputElement | null>(null)
  let results = $state<{
    customers: SearchHit[]
    vehicles: SearchHit[]
    items: SearchHit[]
    documents: SearchHit[]
  }>({ customers: [], vehicles: [], items: [], documents: [] })
  let loading = $state(false)
  /**
   * Flat index into the visible result list. Arrow keys move it, Enter
   * navigates. Reset on every fresh search so the user never has to
   * scroll back up after typing.
   */
  let activeIndex = $state(0)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const buckets = $derived<Bucket[]>(
    [
      {
        key: 'customers' as const,
        label: 'Kunden',
        icon: Users,
        items: results.customers
      },
      {
        key: 'vehicles' as const,
        label: 'Fahrzeuge',
        icon: Car,
        items: results.vehicles
      },
      {
        key: 'items' as const,
        label: 'Artikel',
        icon: Package,
        items: results.items
      },
      {
        key: 'documents' as const,
        label: 'Belege',
        icon: FileText,
        items: results.documents
      }
    ].filter((b) => b.items.length > 0)
  )

  /** Flat list of hits with their bucket key — used for keyboard navigation. */
  const flatHits = $derived(
    buckets.flatMap((b) => b.items.map((h) => ({ bucket: b.key, hit: h })))
  )

  const totalHits = $derived(flatHits.length)

  /**
   * Resolve the target URL for a single hit. Documents need to branch
   * on `type` because invoices and offers live in different route
   * trees; everything else maps 1:1 to its module's detail page.
   */
  const routeFor = (
    bucket: 'customers' | 'vehicles' | 'items' | 'documents',
    hit: SearchHit
  ): string => {
    switch (bucket) {
      case 'customers':
        return `/customers/${hit.id}`
      case 'vehicles':
        return `/vehicles/${hit.id}`
      case 'items':
        return `/items/${hit.id}`
      case 'documents': {
        const t = hit.type ?? 'invoice'
        if (t === 'invoice' || t === 'credit_note') {
          return `/invoices/${hit.id}`
        }
        // offer, cost_estimate, order_confirmation all live under /offers
        return `/offers/${hit.id}`
      }
    }
  }

  const reset = () => {
    q = ''
    results = { customers: [], vehicles: [], items: [], documents: [] }
    activeIndex = 0
    loading = false
  }

  const close = () => {
    open = false
    reset()
  }

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) {
      results = { customers: [], vehicles: [], items: [], documents: [] }
      loading = false
      activeIndex = 0
      return
    }
    loading = true
    try {
      const res = await globalSearchRemote({ q: term })
      results = res
      activeIndex = 0
    } finally {
      loading = false
    }
  }

  const handleInput = (e: Event) => {
    q = (e.target as HTMLInputElement).value
    if (searchTimer) clearTimeout(searchTimer)
    const term = q
    searchTimer = setTimeout(() => void runSearch(term), 250)
  }

  const handleSelect = (
    bucket: 'customers' | 'vehicles' | 'items' | 'documents',
    hit: SearchHit
  ) => {
    const target = routeFor(bucket, hit)
    close()
    goto(target)
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (totalHits === 0) return
      activeIndex = (activeIndex + 1) % totalHits
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (totalHits === 0) return
      activeIndex = (activeIndex - 1 + totalHits) % totalHits
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const target = flatHits[activeIndex]
      if (target) handleSelect(target.bucket, target.hit)
    }
  }

  /**
   * Open / close lifecycle: focus the input when the modal opens,
   * clear state on close. Using `$effect` so the autofocus does not
   * require a brittle `autofocus` attribute.
   */
  $effect(() => {
    if (open) {
      // Slight delay so the input is in the DOM when we focus it.
      queueMicrotask(() => input?.focus())
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <dialog class="modal modal-open" data-testid="global-search-dialog">
    <div
      class="modal-box flex h-[80dvh] max-h-[640px] w-full max-w-2xl flex-col p-0"
    >
      <header class="border-base-300 border-b px-4 py-3">
        <label class="input input-bordered flex w-full items-center gap-2">
          <Search size={16} class="opacity-60" />
          <input
            bind:this={input}
            type="search"
            class="grow"
            placeholder="Suchen…"
            value={q}
            oninput={handleInput}
            maxlength="200"
            data-testid="global-search-input"
          />
          <button
            type="button"
            class="btn btn-ghost btn-square btn-xs"
            aria-label="Schließen"
            onclick={close}
          >
            <X size={14} />
          </button>
        </label>
      </header>

      <div
        class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
        data-testid="global-search-results"
      >
        {#if q.trim().length < 2}
          <div
            class="text-base-content/60 flex h-full items-center justify-center text-sm"
          >
            Mindestens 2 Zeichen eingeben.
          </div>
        {:else if loading && totalHits === 0}
          <div
            class="text-base-content/60 flex h-full items-center justify-center text-sm"
          >
            Suche läuft…
          </div>
        {:else if totalHits === 0}
          <div
            class="text-base-content/60 flex h-full items-center justify-center text-sm"
          >
            Keine Treffer.
          </div>
        {:else}
          {#each buckets as bucket (bucket.key)}
            {@const Icon = bucket.icon}
            <div>
              <div
                class="bg-base-200 text-base-content/70 sticky top-0 flex items-center gap-2 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase"
              >
                <Icon size={12} />
                <span>{bucket.label}</span>
                <span class="text-base-content/50 normal-case">
                  ({bucket.items.length})
                </span>
              </div>
              <ul class="divide-base-300 divide-y">
                {#each bucket.items as hit (hit.id)}
                  {@const idx = flatHits.findIndex(
                    (f) => f.bucket === bucket.key && f.hit.id === hit.id
                  )}
                  <li>
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-2 px-4 py-2 text-left"
                      class:bg-base-200={idx === activeIndex}
                      data-testid="global-search-hit"
                      data-active={idx === activeIndex ? 'true' : 'false'}
                      onmouseenter={() => (activeIndex = idx)}
                      onclick={() => handleSelect(bucket.key, hit)}
                    >
                      <span class="flex min-w-0 flex-col">
                        <span class="truncate text-sm">{hit.label}</span>
                        {#if hit.sublabel}
                          <span class="text-base-content/60 truncate text-xs">
                            {hit.sublabel}
                          </span>
                        {/if}
                      </span>
                    </button>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        {/if}
      </div>

      <footer
        class="border-base-300 text-base-content/60 flex items-center justify-between gap-2 border-t px-4 py-2 text-xs"
      >
        <span class="flex items-center gap-2">
          <kbd class="kbd kbd-xs">↑</kbd>
          <kbd class="kbd kbd-xs">↓</kbd>
          <span>Navigieren</span>
        </span>
        <span class="flex items-center gap-2">
          <kbd class="kbd kbd-xs">↵</kbd>
          <span>Öffnen</span>
        </span>
        <span class="flex items-center gap-2">
          <kbd class="kbd kbd-xs">Esc</kbd>
          <span>Schließen</span>
        </span>
      </footer>
    </div>
    <button
      type="button"
      class="modal-backdrop"
      aria-label="Dialog schließen"
      onclick={close}
    ></button>
  </dialog>
{/if}
