/**
 * Global page-title store. Each page sets its title via $effect; the AppShell
 * reads it for the header bar.
 *
 * The store falls back to the route-derived default when no page set a title
 * (handled by the AppShell).
 */
function createPageTitleStore() {
  let title = $state<string | null>(null)

  const set = (t: string) => {
    title = t
  }
  const reset = () => {
    title = null
  }

  return {
    get current() {
      return title
    },
    set,
    reset
  }
}

export const pageTitle = createPageTitleStore()
