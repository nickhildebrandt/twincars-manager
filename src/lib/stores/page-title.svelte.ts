import type { Component } from 'svelte'

export type PrimaryAction = {
  label: string
  href?: string
  onClick?: () => void
  icon?: Component
}

export type BackTarget = string | (() => void)

/**
 * Global page-header store. Pages set their title, optional back-target and
 * an optional primary action via `<PageHeader …>` — the AppShell renders all
 * three in the top bar.
 */
function createPageHeaderStore() {
  let title = $state<string | null>(null)
  let backTarget = $state<BackTarget | null>(null)
  let primaryAction = $state<PrimaryAction | null>(null)

  const set = (next: {
    title: string
    back?: BackTarget
    primaryAction?: PrimaryAction
  }) => {
    title = next.title
    backTarget = next.back ?? null
    primaryAction = next.primaryAction ?? null
  }

  const reset = () => {
    title = null
    backTarget = null
    primaryAction = null
  }

  return {
    get title() {
      return title
    },
    get backTarget() {
      return backTarget
    },
    get primaryAction() {
      return primaryAction
    },
    set,
    reset
  }
}

export const pageHeader = createPageHeaderStore()

// Backwards-compatible alias used by older tests.
export const pageTitle = {
  get current() {
    return pageHeader.title
  },
  set: (t: string) => pageHeader.set({ title: t }),
  reset: () => pageHeader.reset()
}
