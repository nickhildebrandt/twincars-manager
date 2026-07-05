import { query } from '$app/server'
import { requireUser } from '$lib/server/auth-guards'
import {
  getDashboardKpis as loadDashboardKpis,
  getUpcoming,
  type UpcomingItem
} from '$lib/server/services/dashboard-service'

export type { UpcomingItem }

/**
 * Dashboard KPI summary.
 *
 * @group integration
 * @module dashboard
 */
export const getDashboardKpis = query(async () => {
  requireUser()
  return loadDashboardKpis()
})

/**
 * Top-10 anstehende Termine (HU-Fälligkeiten + Kalender-Termine),
 * siehe `getUpcoming` in `dashboard-service.ts`.
 *
 * @group integration
 * @module dashboard
 */
export const getUpcomingRemote = query(async (): Promise<UpcomingItem[]> => {
  requireUser()
  return getUpcoming()
})
