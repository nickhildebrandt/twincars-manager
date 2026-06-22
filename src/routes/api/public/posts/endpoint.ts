/**
 * Handler implementation for `GET /api/public/posts`.
 *
 * Returns the published „Aktuelle Informationen" news posts for the
 * public website, newest first, paginated. Drafts are never exposed.
 *
 * Query parameters (all optional):
 *  - `page`     — 1-based page number (default 1)
 *  - `pageSize` — items per page, 1–50 (default 10)
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import { fail, ok } from '$lib/server/public-api'
import {
  listPublicPosts,
  type PublicPostRow
} from '$lib/server/services/post-service'

export type PublicPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  publishedAt: string | null
  coverImage: { mime: string; url: string } | null
}

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

/** Parse a positive-integer query param, failing with a 400 on garbage. */
function parsePositiveInt(
  raw: string | null,
  fallback: number,
  label: string
): number {
  if (raw == null || raw.length === 0) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    fail(400, `${label} must be a positive integer.`)
  }
  return n
}

export function toPublicPost(row: PublicPostRow): PublicPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    coverImage: row.coverImage
      ? { mime: row.coverImage.mime, url: row.coverImage.data }
      : null
  }
}

export async function handlePublicPosts(
  event: RequestEvent
): Promise<Response> {
  const url = event.url
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 'page')
  const pageSizeRaw = parsePositiveInt(
    url.searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
    'pageSize'
  )
  const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE)

  const result = await listPublicPosts(page, pageSize)
  return ok({
    posts: result.items.map(toPublicPost),
    total: result.total,
    page: result.page,
    pageSize: result.size,
    pageCount: result.pageCount
  })
}
