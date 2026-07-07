<script lang="ts" generics="T extends { id: string; label: string }">
  import { Search, X, ChevronDown, Plus } from '@lucide/svelte'
  import Pagination from './Pagination.svelte'
  import Loader from './Loader.svelte'

  /**
   * Multi-select variant of SearchablePicker: same dialog (server-side
   * search + pagination, optional header create affordance), but rows
   * carry checkboxes and the selection is kept across pages. The
   * dialog is transactional — "Übernehmen (N)" writes the selection
   * back to the bindable props, "Abbrechen" / backdrop discards it.
   */
  type Props = {
    /** Selected ids. Bindable. */
    values?: string[]
    /**
     * id -> label of the selected entries (drives the trigger text).
     * Accepts a Map or an entry array; the component always writes a
     * Map back. Bindable.
     */
    valueLabels?: Map<string, string> | Array<[string, string]>
    placeholder?: string
    dialogTitle?: string
    emptyText?: string
    // Server-side search function. Returns paginated results.
    search: (params: {
      q: string
      page: number
      size: number
    }) => Promise<{ items: T[]; total: number; pageCount: number }>
    /** Fires after "Übernehmen" or the trigger clear with the new ids. */
    onChange?: (values: string[]) => void
    disabled?: boolean
    /** Trigger height variant, mirrors SearchablePicker. */
    triggerSize?: 'sm' | 'md'
    /** Header "Neu anlegen" label — rendered only with onCreateNew. */
    createLabel?: string
    /** Full-page creation flow hook, mirrors SearchablePicker. */
    onCreateNew?: () => void
  }

  let {
    values = $bindable([]),
    valueLabels = $bindable(new Map<string, string>()),
    placeholder = 'Bitte wählen',
    dialogTitle = 'Auswählen',
    emptyText = 'Keine passenden Einträge gefunden.',
    search,
    onChange,
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

  /**
   * Working copy of the selection while the dialog is open. Seeded
   * from the bound props on open, written back only on "Übernehmen" —
   * reassigned on every toggle so Svelte tracks the change.
   */
  let selection = $state(new Map<string, string>())

  const canCreate = $derived(Boolean(createLabel && onCreateNew))

  const labelMap = $derived(
    valueLabels instanceof Map ? valueLabels : new Map(valueLabels)
  )

  /** Trigger text: placeholder, joined labels (≤ 2) or "N ausgewählt". */
  const triggerText = $derived(
    values.length === 0
      ? placeholder
      : values.length > 2
        ? `${values.length} ausgewählt`
        : values.map((id) => labelMap.get(id) ?? id).join(', ')
  )

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
    selection = new Map(values.map((id) => [id, labelMap.get(id) ?? id]))
    dialog?.showModal()
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

  const toggle = (item: T) => {
    const next = new Map(selection)
    if (next.has(item.id)) next.delete(item.id)
    else next.set(item.id, item.label)
    selection = next
  }

  const apply = () => {
    values = [...selection.keys()]
    valueLabels = new Map(selection)
    onChange?.(values)
    close()
  }

  const handleClear = (e: Event) => {
    e.stopPropagation()
    values = []
    valueLabels = new Map()
    onChange?.([])
  }

  /** Keyboard activation for the span[role=button] clear affordance. */
  const handleClearKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    handleClear(e)
  }

  /**
   * Single click entry for the trigger button — same workaround as in
   * SearchablePicker: delegated clicks never reach the nested clear
   * span's own onclick, so the button handler decides via `closest()`.
   */
  const handleTriggerClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-picker-clear]')) {
      handleClear(e)
      return
    }
    open()
  }

  /** Close first — the host navigates to the full creation page. */
  const handleCreateNew = () => {
    close()
    onCreateNew?.()
  }
</script>

<!--
	Trigger anatomy mirrors SearchablePicker: a real <button> (first
	labelable descendant inside FormField <label> hosts), the clear "X"
	as span[role=button] with its own keyboard handling, both icons in
	one flex group flush right.
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
    class={values.length > 0
      ? 'text-base-content truncate'
      : 'text-base-content/50 truncate'}
  >
    {triggerText}
  </span>
  <span class="flex shrink-0 items-center gap-1">
    {#if values.length > 0 && !disabled}
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
  <!-- Stable dialog dimensions, identical to SearchablePicker. -->
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
              <label
                class="hover:bg-base-200 flex w-full cursor-pointer items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  checked={selection.has(item.id)}
                  onchange={() => toggle(item)}
                />
                <span class="truncate">{item.label}</span>
              </label>
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
    <div
      class="border-base-300 flex items-center justify-end gap-2 border-t px-4 py-3"
    >
      <button type="button" class="btn btn-ghost" onclick={close}>
        Abbrechen
      </button>
      <button type="button" class="btn btn-primary" onclick={apply}>
        Übernehmen ({selection.size})
      </button>
    </div>
  </div>
  <button
    type="button"
    class="modal-backdrop"
    aria-label="Dialog schließen"
    onclick={close}
  ></button>
</dialog>
