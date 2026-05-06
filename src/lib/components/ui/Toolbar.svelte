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

<!--
  Search / filter bar shares the flat card baseline used everywhere else
  (`card border border-base-300 bg-base-100`). We bypass `card-body` to
  keep the row layout — the `card` class on its own gives us the same
  background, border colour and `rounded-box` radius.
-->
<div
  class="card border-base-300 bg-base-100 flex flex-col gap-3 border p-3 sm:flex-row sm:flex-wrap sm:items-center"
>
  <!-- Search input grows to fill available space -->
  <label
    class="input input-bordered input-sm flex w-full items-center gap-2 sm:min-w-[16rem] sm:flex-1"
  >
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
    <div class="flex flex-wrap items-center gap-2">
      {@render filters()}
    </div>
  {/if}

  {#if actions}
    <div class="flex flex-wrap items-center gap-2 sm:ms-auto"
      >{@render actions()}</div
    >
  {/if}
</div>
