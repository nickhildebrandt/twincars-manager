import { auth } from '$lib/server/auth'
import type { RequestHandler } from './$types'

/**
 * better-auth catch-all endpoint. This is the one place where a
 * SvelteKit `+server.ts` handler is permitted: it is third-party
 * library plumbing, not app data flow. All app data flow continues to
 * go through `*.remote.ts` files.
 */
const handler: RequestHandler = ({ request }) => auth.handler(request)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
