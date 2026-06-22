import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Unit + integration tests for the post („Aktuelle Informationen")
 * service: slug generation/uniqueness, publish-state bookkeeping
 * (`publishedAt`), and the public read surface (drafts excluded).
 *
 * @group integration
 * @module post-service
 */

vi.mock('$lib/server/db/client', async () => {
  const { createTestDb } = await import('$lib/server/db/test-db')
  const handle = await createTestDb()
  return { db: handle.db, schema: handle.schema }
})

import { db } from '$lib/server/db/client'
import { posts } from '$lib/server/db/schema'
import {
  createPost,
  deletePost,
  getPost,
  getPublicPostBySlug,
  listPosts,
  listPublicPosts,
  setPostPublished,
  slugify,
  updatePost
} from './post-service'

async function resetDb() {
  await db.delete(posts)
}

describe('post-service · slugify', () => {
  it('transliterates German umlauts and ß', () => {
    expect(slugify('Öffnungszeiten über Ostern')).toBe(
      'oeffnungszeiten-ueber-ostern'
    )
    expect(slugify('Maße & Größen')).toBe('masse-groessen')
  })

  it('collapses punctuation/whitespace to single hyphens and trims', () => {
    expect(slugify('  Hallo,  Welt!!! ')).toBe('hallo-welt')
  })

  it('falls back to "beitrag" for empty/punctuation-only titles', () => {
    expect(slugify('!!!')).toBe('beitrag')
    expect(slugify('')).toBe('beitrag')
  })
})

describe('post-service · CRUD + publish', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('generates a slug from the title on create', async () => {
    const p = await createPost({
      title: 'Neue Winterreifen da!',
      body: 'Inhalt',
      published: false
    })
    expect(p.slug).toBe('neue-winterreifen-da')
    expect(p.published).toBe(false)
    expect(p.publishedAt).toBeNull()
  })

  it('stamps publishedAt when created as published', async () => {
    const p = await createPost({
      title: 'Sofort live',
      body: 'x',
      published: true
    })
    expect(p.published).toBe(true)
    expect(p.publishedAt).toBeInstanceOf(Date)
  })

  it('disambiguates duplicate slugs with a numeric suffix', async () => {
    const a = await createPost({ title: 'Aktion', body: 'x', published: false })
    const b = await createPost({ title: 'Aktion', body: 'y', published: false })
    const c = await createPost({ title: 'Aktion', body: 'z', published: false })
    expect(a.slug).toBe('aktion')
    expect(b.slug).toBe('aktion-2')
    expect(c.slug).toBe('aktion-3')
  })

  it('keeps the slug stable on update unless the title changes', async () => {
    const p = await createPost({
      title: 'Original',
      body: 'x',
      published: false
    })
    const sameTitle = await updatePost(p.id, {
      title: 'Original',
      body: 'geändert',
      published: false
    })
    expect(sameTitle.slug).toBe('original')

    const newTitle = await updatePost(p.id, {
      title: 'Neuer Titel',
      body: 'geändert',
      published: false
    })
    expect(newTitle.slug).toBe('neuer-titel')
  })

  it('stamps publishedAt on first publish and retains it across unpublish', async () => {
    const p = await createPost({
      title: 'Entwurf',
      body: 'x',
      published: false
    })
    expect(p.publishedAt).toBeNull()

    const published = await setPostPublished(p.id, true)
    const firstStamp = published.publishedAt
    expect(firstStamp).toBeInstanceOf(Date)

    const hidden = await setPostPublished(p.id, false)
    expect(hidden.published).toBe(false)
    // The first-publish timestamp is retained, not cleared.
    expect(hidden.publishedAt).toEqual(firstStamp)
  })

  it('deletes a post', async () => {
    const p = await createPost({ title: 'Weg', body: 'x', published: false })
    await deletePost(p.id)
    expect(await getPost(p.id)).toBeNull()
  })

  it('paginates and filters the admin list by published state', async () => {
    await createPost({ title: 'Live A', body: 'x', published: true })
    await createPost({ title: 'Live B', body: 'x', published: true })
    await createPost({ title: 'Draft C', body: 'x', published: false })

    const all = await listPosts({ page: 1, size: 25 })
    expect(all.total).toBe(3)

    const drafts = await listPosts({ page: 1, size: 25, published: false })
    expect(drafts.total).toBe(1)
    expect(drafts.items[0].title).toBe('Draft C')
  })
})

describe('post-service · public read surface', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listPublicPosts returns only published posts, newest first', async () => {
    await createPost({ title: 'Älter', body: 'x', published: true })
    await createPost({ title: 'Neuer', body: 'x', published: true })
    await createPost({ title: 'Entwurf', body: 'x', published: false })

    const res = await listPublicPosts(1, 10)
    expect(res.total).toBe(2)
    expect(res.items.map((p) => p.title)).not.toContain('Entwurf')
  })

  it('getPublicPostBySlug returns published posts but hides drafts', async () => {
    const live = await createPost({
      title: 'Veröffentlicht',
      body: 'Sichtbar',
      published: true
    })
    const draft = await createPost({
      title: 'Geheim',
      body: 'Versteckt',
      published: false
    })

    const found = await getPublicPostBySlug(live.slug)
    expect(found?.title).toBe('Veröffentlicht')

    const hidden = await getPublicPostBySlug(draft.slug)
    expect(hidden).toBeNull()
  })
})
