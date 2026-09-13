/**
 * `definePageMeta({ permission: 'customers' })`.
 *
 * Declared here so a typo in a module key is a compile error rather than a
 * page that silently lets everybody in.
 */
import type { ModuleKey } from '../shared/permissions'

declare module 'vue-router' {
  interface RouteMeta {
    permission?: ModuleKey
  }
}

export {}
