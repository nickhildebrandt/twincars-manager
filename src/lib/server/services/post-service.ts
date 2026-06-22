import { db } from '$lib/server/db/client'
import { posts } from '$lib/server/db/schema'
import { and, count, desc, eq, ilike, ne, or } from 'drizzle-orm'
import type { ListParams, ListResult } from '$lib/server/db/validation'
import type { Post, NewPost } from '$lib/server/db/schema'

/**
 * Turn a title into a URL-safe slug. German umlauts and ß are
 * transliterated (ä→ae …) before everything non-alphanumeric collapses
 * to single hyphens, so `Öffnungszeiten & mehr!` → `oeffnungszeiten-mehr`.
 * Falls back to `beitrag` for titles that reduce to nothing (e.g. only
 * punctuation) so the column never ends up empty.
 */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
  return base || 'beitrag'
}

/**
 * Resolve a unique slug for `base`, ignoring `excludeId` (so updating a
 * post doesn't collide with itself). Appends `-2`, `-3`, … until free.
 */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base
  let n = 1
  // Loop is bounded in practice — collisions are rare and each step is a
  // single indexed lookup on `posts_slug_idx`.
  for (;;) {
    const clash = await db
      .select({ id: posts.id })
      .from(posts)
      .where(
        excludeId
          ? and(eq(posts.slug, candidate), ne(posts.id, excludeId))
          : eq(posts.slug, candidate)
      )
      .limit(1)
    if (clash.length === 0) return candidate
    n += 1
    candidate = `${base}-${n}`.slice(0, 220)
  }
}

export type PostInput = {
  title: string
  excerpt?: string
  body: string
  coverImage?: { mime: string; data: string } | null
  published: boolean
}

/**
 * Paginated admin post list with optional title/body search and a
 * published-state filter (`published` | `draft` | `all`).
 */
export async function listPosts(
  params: ListParams & { published?: boolean }
): Promise<ListResult<Post>> {
  const { page, size, q, published } = params
  const offset = (page - 1) * size
  const filters = []
  if (q) {
    const term = `%${q}%`
    filters.push(or(ilike(posts.title, term), ilike(posts.excerpt, term)))
  }
  if (typeof published === 'boolean')
    filters.push(eq(posts.published, published))
  const where = filters.length > 0 ? and(...filters) : undefined

  const [items, totalRow] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(posts).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

export async function getPost(id: string): Promise<Post | null> {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  return row ?? null
}

export async function createPost(input: PostInput): Promise<Post> {
  const slug = await uniqueSlug(slugify(input.title))
  const values: NewPost = {
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    body: input.body,
    coverImage: input.coverImage ?? null,
    published: input.published,
    publishedAt: input.published ? new Date() : null
  }
  const [created] = await db.insert(posts).values(values).returning()
  return created
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const current = await getPost(id)
  if (!current) throw new Error('Beitrag nicht gefunden.')

  // Slug stays stable once created (preserves website permalinks); only
  // regenerate when the title actually changed.
  const slug =
    input.title === current.title
      ? current.slug
      : await uniqueSlug(slugify(input.title), id)

  // `publishedAt` records the FIRST publication and is retained across a
  // later unpublish; it is only stamped when a draft first goes live.
  const publishedAt =
    input.published && current.publishedAt == null
      ? new Date()
      : current.publishedAt

  const [updated] = await db
    .update(posts)
    .set({
      title: input.title,
      slug,
      excerpt: input.excerpt ?? null,
      body: input.body,
      coverImage: input.coverImage ?? null,
      published: input.published,
      publishedAt,
      updatedAt: new Date()
    })
    .where(eq(posts.id, id))
    .returning()
  return updated
}

/**
 * Flip the published flag without touching the rest of the post.
 * Stamps `publishedAt` the first time the post goes live.
 */
export async function setPostPublished(
  id: string,
  published: boolean
): Promise<Post> {
  const current = await getPost(id)
  if (!current) throw new Error('Beitrag nicht gefunden.')
  const publishedAt =
    published && current.publishedAt == null ? new Date() : current.publishedAt
  const [updated] = await db
    .update(posts)
    .set({ published, publishedAt, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .returning()
  return updated
}

export async function deletePost(id: string): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id))
}

/* ── Public (website) read surface ─────────────────────────────────── */

export type PublicPostRow = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body: string
  coverImage: { mime: string; data: string } | null
  publishedAt: Date | null
}

/**
 * Paginated list of published posts for the public website, newest
 * first. Drafts are never returned.
 */
export async function listPublicPosts(
  page: number,
  size: number
): Promise<ListResult<PublicPostRow>> {
  const offset = (page - 1) * size
  const where = eq(posts.published, true)
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        body: posts.body,
        coverImage: posts.coverImage,
        publishedAt: posts.publishedAt
      })
      .from(posts)
      .where(where)
      .orderBy(desc(posts.publishedAt), desc(posts.createdAt))
      .limit(size)
      .offset(offset),
    db.select({ value: count() }).from(posts).where(where)
  ])
  const total = Number(totalRow[0]?.value ?? 0)
  return {
    items: rows,
    total,
    page,
    size,
    pageCount: Math.max(1, Math.ceil(total / size))
  }
}

/** Single published post by slug, or null if unknown / still a draft. */
export async function getPublicPostBySlug(
  slug: string
): Promise<PublicPostRow | null> {
  const [row] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      body: posts.body,
      coverImage: posts.coverImage,
      publishedAt: posts.publishedAt
    })
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.published, true)))
    .limit(1)
  return row ?? null
}
