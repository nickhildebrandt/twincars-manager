import type { LayoutServerLoad } from './$types'
import { getSettings } from '$lib/server/services/settings-service'

export const load: LayoutServerLoad = async ({ url }) => {
  const settings = await getSettings()
  return {
    setupCompleted: settings.setupCompleted,
    companyName: settings.companyName || 'TwinCarsManager',
    isSetupRoute: url.pathname.startsWith('/setup'),
    currentPath: url.pathname
  }
}
