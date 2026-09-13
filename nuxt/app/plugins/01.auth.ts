/**
 * Loads the session once, before the first page renders.
 *
 * Universal on purpose: on the server the result goes into the rendered HTML,
 * and the browser picks it up from there instead of asking again.
 */
export default defineNuxtPlugin({
  name: 'auth',
  enforce: 'pre',
  async setup() {
    const state = useAuthState()
    if (state.value.user) return

    try {
      state.value = await useRequestFetch()('/api/me') as typeof state.value
    }
    catch {
      // No session, or the server is not answering. The route middleware
      // sends the visitor to the login; nothing to report here.
    }
  },
})
