<script lang="ts" generics="T extends { id: string; label: string }">
  import { Search, X, ChevronDown, Plus } from '@lucide/svelte'
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
    /**
     * Trigger height variant. 'sm' matches `input-sm` neighbours in
     * compact filter toolbars; default is the full-size form input.
     */
    triggerSize?: 'sm' | 'md'
    /**
     * Label of the "Neu anlegen" affordance shown exactly once in the
     * dialog header, next to the close button. Only when BOTH
     * `createLabel` and `onCreateNew` are set is the button rendered.
     */
    createLabel?: string
    /**
     * Navigates to the entity's regular full-page creation flow (the
     * host wires `creationFlow.start(...)` + `goto(...)`). The dialog
     * closes before the callback fires.
     */
    onCreateNew?: () => void
  }

  let {
    value = $bindable(''),
    valueLabel = $bindable(''),
    placeholder = 'Bitte wählen',
    dialogTitle = 'Auswählen',
    emptyText = 'Keine passenden Einträge gefunden.',
    search,
    onSelect,
    disabled = false,
    triggerSize = 'md',
    createLabel,
    onCreateNew
  }: Props = $props()

  let dialog = $state<HTMLDialogElement | null>(null)
  let searchInput = $state<HTMLInputElement | null>(null)
  let q = $state('')
  let page = $state(1)
  const size = 25
  let items = $state<T[]>([])
  let total = $state(0)
  let pageCount = $state(1)
  let loading = $state(false)

  const canCreate = $derived(Boolean(createLabel && onCreateNew))

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
    // Focus the search input after the dialog is shown — replaces the
    // accessibility-flagged `autofocus` attribute with explicit focus.
    queueMicrotask(() => searchInput?.focus())
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

  /**
   * Single click entry for the trigger button. The clear "X" is a
   * span INSIDE the trigger <button>; Svelte's delegated click never
   * reaches the span's own onclick here (clicks fell through to
   * `open`, so the selection could not be cleared by mouse at all).
   * Deciding on the button handler via `closest()` is robust against
   * that: X clears, everything else opens the dialog.
   */
  const handleTriggerClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-picker-clear]')) {
      handleClear(e)
      return
    }
    open()
  }

  /** Keyboard activation for the span[role=button] clear affordance. */
  const handleClearKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleClear(e)
  }

  /** Close first — the host navigates to the full creation page. */
  const handleCreateNew = () => {
    close()
    onCreateNew?.()
  }
</script>

<!--
	Trigger anatomy: the outer element stays a real <button> (it must
	remain the first labelable descendant when a host wraps the picker
	in a FormField <label> — a non-labelable trigger would forward label
	clicks into the dialog's buttons). The clear "X" therefore cannot be
	a nested <button> (invalid HTML); it is a span[role=button] with its
	own keyboard handling. Both icons sit in one flex group flush right —
	no absolute positioning, no reserved padding.
-->
<button
  type="button"
  class="input input-bordered flex w-full items-center justify-between gap-2 {triggerSize ===
  'sm'
    ? 'input-sm'
    : ''}"
  {disabled}
  onclick={handleTriggerClick}
>
  <span
    class={value
      ? 'text-base-content truncate'
      : 'text-base-content/50 truncate'}
  >
    {value ? valueLabel : placeholder}
  </span>
  <span class="flex shrink-0 items-center gap-1">
    {#if value && !disabled}
      <span
        role="button"
        tabindex="0"
        class="btn btn-ghost btn-square btn-xs"
        aria-label="Auswahl entfernen"
        data-picker-clear
        onclick={handleClear}
        onkeydown={handleClearKey}
      >
        <X size={14} />
      </span>
    {/if}
    <ChevronDown size={16} class="shrink-0 opacity-60" />
  </span>
</button>

<dialog bind:this={dialog} class="modal">
  <!--
		Stable dialog dimensions: fixed width, fixed height — independent of how
		many results are loaded. The list area scrolls inside.
	-->
  <div
    class="modal-box flex h-[80dvh] max-h-[640px] w-full max-w-2xl flex-col p-0"
  >
    <header
      class="border-base-300 flex items-center justify-between gap-2 border-b px-4 py-3"
    >
      <h3 class="truncate text-base font-semibold">{dialogTitle}</h3>
      <div class="flex shrink-0 items-center gap-1">
        {#if canCreate}
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            onclick={handleCreateNew}
          >
            <Plus size={14} />
            {createLabel}
          </button>
        {/if}
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          aria-label="Schließen"
          onclick={close}
        >
          <X size={16} />
        </button>
      </div>
    </header>
    <div class="border-base-300 border-b px-4 py-3">
      <label
        class="input input-bordered input-sm flex w-full items-center gap-2"
      >
        <Search size={14} class="opacity-60" />
        <input
          bind:this={searchInput}
          type="text"
          class="grow"
          placeholder="Suchen…"
          value={q}
          oninput={handleQuery}
          maxlength="200"
        />
      </label>
    </div>
    <div class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">
      {#if loading && items.length === 0}
        <div class="flex h-full items-center justify-center">
          <Loader />
        </div>
      {:else if items.length === 0}
        <div class="flex h-full items-center justify-center px-4">
          <span class="text-base-content/60 text-center text-sm">
            {emptyText}
          </span>
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
