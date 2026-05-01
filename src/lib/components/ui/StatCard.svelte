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

<div class="card bg-base-100 border-base-300 border shadow-sm">
  <div class="card-body p-4 sm:p-5">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="text-base-content/60 text-xs tracking-wide uppercase"
          >{title}</p
        >
        <p class="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
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
