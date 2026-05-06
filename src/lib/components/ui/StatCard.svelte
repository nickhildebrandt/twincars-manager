<script lang="ts">
  import type { Component } from 'svelte'

  type Props = {
    title: string
    value: string | number
    desc?: string
    icon?: Component
    color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  }

  const { title, value, desc, icon, color }: Props = $props()
  const Icon = $derived(icon)
</script>

<div class="card border-base-300 bg-base-100 border">
  <div class="card-body p-4 sm:p-5">
    <div class="flex items-center justify-between gap-3">
      <!--
        `min-w-0` lets the value column shrink instead of pushing the
        icon out; `truncate` then clips long EUR strings (e.g.
        "1.234.567,89 €") on narrow viewports rather than wrapping or
        breaking the card. `tabular-nums` keeps digit columns aligned.
      -->
      <div class="min-w-0 flex-1">
        <p class="text-base-content/60 text-xs tracking-wide uppercase"
          >{title}</p
        >
        <p
          class="mt-1 truncate text-xl font-bold tabular-nums sm:text-2xl lg:text-3xl"
          title={String(value)}
        >
          {value}
        </p>
        {#if desc}
          <p class="text-base-content/60 mt-1 text-xs">{desc}</p>
        {/if}
      </div>
      {#if Icon}
        <div
          class="rounded-lg p-2"
          class:bg-primary={color === 'primary'}
          class:text-primary-content={color === 'primary'}
          class:bg-success={color === 'success'}
          class:text-success-content={color === 'success'}
          class:bg-warning={color === 'warning'}
          class:text-warning-content={color === 'warning'}
          class:bg-error={color === 'error'}
          class:text-error-content={color === 'error'}
          class:bg-info={color === 'info'}
          class:text-info-content={color === 'info'}
          class:bg-base-200={!color}
          class:text-base-content={!color}
        >
          <Icon size={22} />
        </div>
      {/if}
    </div>
  </div>
</div>
