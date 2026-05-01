<script lang="ts">
  import { Search } from '@lucide/svelte'
  import type { Snippet } from 'svelte'

  type Props = {
    query?: string
    placeholder?: string
    onQuery?: (q: string) => void
    filters?: Snippet
    actions?: Snippet
  }

  let {
    query = $bindable(''),
    placeholder = 'Suchen…',
    onQuery,
    filters,
    actions
  }: Props = $props()

  let timer: ReturnType<typeof setTimeout> | null = null
  const handleInput = (e: Event) => {
    query = (e.target as HTMLInputElement).value
    if (!onQuery) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => onQuery(query), 250)
  }
</script>

<div
  class="border-base-300 bg-base-100 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
>
  <div class="flex flex-1 flex-wrap items-center gap-2">
    <label class="input input-sm w-full sm:w-72">
      <Search size={16} class="opacity-60" />
      <input
        type="search"
        class="grow"
        {placeholder}
        value={query}
        oninput={handleInput}
        maxlength="200"
      />
    </label>
    {#if filters}
      {@render filters()}
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 flex-wrap items-center gap-2"
      >{@render actions()}</div
    >
  {/if}
</div>
