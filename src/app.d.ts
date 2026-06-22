// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuthSession } from '$lib/server/auth'

declare global {
  namespace App {
    interface Locals {
      /** Active session payload from better-auth, or `null` when anonymous. */
      session: NonNullable<AuthSession>['session'] | null
      /** Currently authenticated user, or `null` when anonymous. */
      user: NonNullable<AuthSession>['user'] | null
      /** Permission strings granted via the user's roles. */
      permissions: Set<string>
    }
  }
}

export {}
