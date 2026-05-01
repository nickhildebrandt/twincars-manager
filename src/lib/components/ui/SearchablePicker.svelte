<script lang="ts" generics="T extends { id: string; label: string }">
  import { Search, X, ChevronDown } from '@lucide/svelte'
  import Pagination from './Pagination.svelte'
  import Loader from './Loader.svelte'

  type Props = {
    value: string
    valueLabel?: string
    placeholder?: string
    dialogTitle?: string
    emptyText?: string
    // Server-side search function. Returns paginated results.
    search: (params: {
      q: string
      page: number
      size: number
    }) => Promise<{ items: T[]; total: number; pageCount: number }>
    onSelect: (item: T | null) => void
    disabled?: boolean
  }

  let {
    value = $bindable(''),
    valueLabel = $bindable(''),
    placeholder = '— wählen —',
    dialogTitle = 'Auswählen',
    emptyText = 'Keine Treffer.',
    search,
    onSelect,
    disabled = false
  }: Props = $props()

  let dialog = $state<HTMLDialogElement | null>(null)
  let q = $state('')
  let page = $state(1)
  const size = 25
  let items = $state<T[]>([])
  let total = $state(0)
  let pageCount = $state(1)
  let loading = $state(false)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const runSearch = async () => {
    loading = true
    try {
      const res = await search({ q, page, size })
      items = res.items
      total = res.total
      pageCount = res.pageCount
    } finally {
      loading = false
    }
  }

  const open = () => {
    if (disabled) return
    page = 1
    dialog?.showModal()
    void runSearch()
  }

  const close = () => {
    dialog?.close()
  }

  const handleQuery = (e: Event) => {
    q = (e.target as HTMLInputElement).value
    page = 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void runSearch(), 250)
  }

  const handleSelect = (item: T) => {
    value = item.id
    valueLabel = item.label
    onSelect(item)
    close()
  }

  const handleClear = (e: Event) => {
    e.stopPropagation()
    value = ''
    valueLabel = ''
    onSelect(null)
  }
</script>

<button
  type="button"
  class="input input-bordered flex w-full items-center justify-between gap-2"
  {disabled}
  onclick={open}
>
  <span
    class={value
      ? 'text-base-content truncate'
      : 'text-base-content/50 truncate'}
  >
    {value ? valueLabel : placeholder}
  </span>
  <span class="flex items-center gap-1">
    {#if value}
      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs"
        aria-label="Auswahl entfernen"
        onclick={handleClear}
      >
        <X size={14} />
      </button>
    {/if}
    <ChevronDown size={16} class="opacity-60" />
  </span>
</button>

<dialog bind:this={dialog} class="modal">
  <!--
		Stable dialog dimensions: fixed width, fixed height — independent of how
		many results are loaded. The list area scrolls inside.
	-->
  <div class="modal-box flex h-[640px] w-full max-w-2xl flex-col p-0">
    <header
      class="border-base-300 flex items-center justify-between border-b px-4 py-3"
    >
      <h3 class="text-base font-semibold">{dialogTitle}</h3>
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label="Schließen"
        onclick={close}
      >
        <X size={16} />
      </button>
    </header>
    <div class="border-base-300 border-b px-4 py-3">
      <label
        class="input input-bordered input-sm flex w-full items-center gap-2"
      >
        <Search size={14} class="opacity-60" />
        <input
          type="search"
          class="grow"
          placeholder="Suchen…"
          value={q}
          oninput={handleQuery}
          maxlength="200"
          autofocus
        />
      </label>
    </div>
    <div class="scroll-y min-h-0 flex-1 overflow-y-auto">
      {#if loading && items.length === 0}
        <div class="flex h-full items-center justify-center">
          <Loader />
        </div>
      {:else if items.length === 0}
        <div
          class="text-base-content/60 flex h-full items-center justify-center text-sm"
        >
          {emptyText}
        </div>
      {:else}
        <ul class="divide-base-300 divide-y">
          {#each items as item (item.id)}
            <li>
              <button
                type="button"
                class="hover:bg-base-200 flex w-full items-center justify-between px-4 py-3 text-left"
                onclick={() => handleSelect(item)}
              >
                <span class="truncate">{item.label}</span>
                {#if item.id === value}
                  <span class="badge badge-primary badge-sm">ausgewählt</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <Pagination
      {page}
      {pageCount}
      {total}
      {size}
      onPage={(p) => {
        page = p
        void runSearch()
      }}
    />
  </div>
  <button
    type="button"
    class="modal-backdrop"
    aria-label="Dialog schließen"
    onclick={close}
  ></button>
</dialog>
