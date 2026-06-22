<script lang="ts">
  import { ChevronDown, X, Check, Search } from '@lucide/svelte'

  type Option = { id: string; label: string; sublabel?: string }

  type Props = {
    options: Option[]
    selected: string[]
    placeholder?: string
    label?: string
    disabled?: boolean
    emptyHint?: string
    /**
     * Fired after every user-initiated change to the selection. Useful
     * for parents that need to mark a form dirty without watching the
     * bindable value via `$effect`. The argument is the new selection.
     */
    onChange?: (selected: string[]) => void
  }

  let {
    options,
    selected = $bindable<string[]>([]),
    placeholder = 'Auswählen…',
    label,
    disabled = false,
    emptyHint = 'Keine Einträge.',
    onChange
  }: Props = $props()

  let open = $state(false)
  let filter = $state('')
  let root = $state<HTMLDivElement | null>(null)
  let filterInput = $state<HTMLInputElement | null>(null)

  const selectedSet = $derived(new Set(selected))
  const selectedOptions = $derived(options.filter((o) => selectedSet.has(o.id)))
  const visibleOptions = $derived.by(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(f) ||
        o.sublabel?.toLowerCase().includes(f)
    )
  })

  const toggle = (id: string) => {
    if (disabled) return
    const next = selectedSet.has(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id]
    selected = next
    onChange?.(next)
  }

  const removeChip = (id: string, e: Event) => {
    e.stopPropagation()
    if (disabled) return
    const next = selected.filter((s) => s !== id)
    selected = next
    onChange?.(next)
  }

  const openDropdown = () => {
    if (disabled) return
    open = true
    queueMicrotask(() => filterInput?.focus())
  }

  const closeDropdown = () => {
    open = false
    filter = ''
  }

  /**
   * Outside click / Escape closes the dropdown. We attach to the
   * document on mount and detach on unmount — `$effect` handles both
   * sides without leaking listeners between renders.
   */
  $effect(() => {
    if (typeof window === 'undefined') return
    const onPointerDown = (e: PointerEvent) => {
      if (!open) return
      if (root && !root.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeDropdown()
      }
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  })
</script>

<div class="relative w-full" bind:this={root} data-testid="multiselect-root">
  {#if label}
    <span class="label-text mb-1 block">{label}</span>
  {/if}
  <div
    role="button"
    tabindex={disabled ? -1 : 0}
    class="input input-bordered flex h-auto min-h-10 w-full cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-left"
    class:cursor-not-allowed={disabled}
    class:opacity-60={disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-disabled={disabled}
    onclick={openDropdown}
    onkeydown={(e) => {
      if (disabled) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openDropdown()
      }
    }}
    data-testid="multiselect-trigger"
  >
    <span class="flex min-w-0 flex-wrap items-center gap-1">
      {#if selectedOptions.length === 0}
        <span class="text-base-content/50 px-1">{placeholder}</span>
      {:else}
        {#each selectedOptions as opt (opt.id)}
          <span
            class="badge badge-neutral badge-sm gap-1"
            data-testid="multiselect-chip"
          >
            <span class="truncate">{opt.label}</span>
            {#if !disabled}
              <button
                type="button"
                class="hover:bg-base-content/10 -mr-1 inline-flex items-center justify-center rounded"
                aria-label={`„${opt.label}" entfernen`}
                onclick={(e) => removeChip(opt.id, e)}
              >
                <X size={12} />
              </button>
            {/if}
          </span>
        {/each}
      {/if}
    </span>
    <ChevronDown size={16} class="shrink-0 opacity-60" />
  </div>

  {#if open}
    <div
      class="bg-base-100 border-base-300 rounded-box absolute left-0 z-30 mt-1 flex w-full flex-col overflow-hidden border"
      role="listbox"
      data-testid="multiselect-dropdown"
    >
      <div class="border-base-300 border-b p-2">
        <label
          class="input input-bordered input-sm flex w-full items-center gap-2"
        >
          <Search size={14} class="opacity-60" />
          <input
            bind:this={filterInput}
            type="search"
            class="grow"
            placeholder="Filtern…"
            bind:value={filter}
            maxlength="200"
            data-testid="multiselect-filter"
          />
        </label>
      </div>
      <div class="max-h-64 [scrollbar-gutter:stable] overflow-y-auto">
        {#if visibleOptions.length === 0}
          <div class="text-base-content/60 px-3 py-4 text-center text-sm">
            {options.length === 0 ? emptyHint : 'Keine Treffer.'}
          </div>
        {:else}
          <ul class="menu menu-sm w-full p-1">
            {#each visibleOptions as opt (opt.id)}
              {@const isOn = selectedSet.has(opt.id)}
              <li>
                <button
                  type="button"
                  class="flex items-center justify-between gap-2"
                  onclick={() => toggle(opt.id)}
                  aria-pressed={isOn}
                  data-testid="multiselect-option"
                  data-option-id={opt.id}
                >
                  <span class="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm pointer-events-none"
                      checked={isOn}
                      tabindex={-1}
                      aria-hidden="true"
                      readonly
                    />
                    <span class="flex min-w-0 flex-col text-left">
                      <span class="truncate">{opt.label}</span>
                      {#if opt.sublabel}
                        <span class="text-base-content/60 truncate text-xs">
                          {opt.sublabel}
                        </span>
                      {/if}
                    </span>
                  </span>
                  {#if isOn}
                    <Check size={14} class="text-primary shrink-0" />
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>
