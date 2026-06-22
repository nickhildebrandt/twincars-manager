import { command, query, requested } from '$app/server'
import { error } from '@sveltejs/kit'
import {
  boolean,
  check,
  maxLength,
  minLength,
  nullable,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
  trim
} from 'valibot'
import { idSchema } from '$lib/server/db/validation'
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  setPostPublished,
  updatePost
} from '$lib/server/services/post-service'
import { requirePermission } from '$lib/server/auth-guards'

/**
 * Secure cover-image payload. The MIME type is restricted to the three
 * raster formats browsers reliably render, and the base64 `data` is
 * capped at ~7 MB (≈ a 5 MB binary image plus base64 overhead) so a
 * malicious payload can't exhaust server memory.
 */
const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp']

const coverImageSchema = object({
  mime: pipe(
    string('Bilddaten fehlen.'),
    trim(),
    check(
      (m) => ALLOWED_IMAGE_MIMES.includes(m),
      'Nur PNG-, JPEG- oder WebP-Bilder sind erlaubt.'
    )
  ),
  data: pipe(
    string('Bilddaten fehlen.'),
    minLength(1, 'Bilddaten dürfen nicht leer sein.'),
    maxLength(7_000_000, 'Das Bild ist zu groß (maximal ca. 5 MB).')
  )
})

const postInputSchema = object({
  title: pipe(
    string('Bitte einen Titel eingeben.'),
    trim(),
    minLength(1, 'Der Titel darf nicht leer sein.'),
    maxLength(200, 'Der Titel darf maximal 200 Zeichen lang sein.')
  ),
  excerpt: optional(
    pipe(
      string(),
      trim(),
      maxLength(500, 'Der Teaser darf maximal 500 Zeichen lang sein.')
    )
  ),
  body: pipe(
    string('Bitte einen Inhalt eingeben.'),
    minLength(1, 'Der Inhalt darf nicht leer sein.'),
    maxLength(50_000, 'Der Inhalt darf maximal 50.000 Zeichen lang sein.')
  ),
  coverImage: optional(nullable(coverImageSchema)),
  published: boolean()
})

const listSchema = object({
  page: number(),
  size: picklist([10, 25, 50, 100]),
  q: optional(pipe(string(), trim(), maxLength(200))),
  published: optional(picklist(['published', 'draft', 'all']))
})

/**
 * Paginated post list for the admin module.
 *
 * @group integration
 * @module posts
 */
export const listPostsRemote = query(listSchema, async (params) => {
  requirePermission('posts')
  const publishedFilter =
    params.published === 'published'
      ? true
      : params.published === 'draft'
        ? false
        : undefined
  return listPosts({ ...params, published: publishedFilter })
})

/**
 * Load a single post.
 *
 * @group integration
 * @module posts
 */
export const getPostRemote = query(object({ id: idSchema }), async ({ id }) => {
  requirePermission('posts')
  const row = await getPost(id)
  if (!row) error(404, 'Beitrag nicht gefunden.')
  return row
})

/**
 * Create a post.
 *
 * @group integration
 * @module posts
 */
export const createPostRemote = command(postInputSchema, async (values) => {
  requirePermission('posts')
  const data = await createPost({
    ...values,
    coverImage: values.coverImage ?? null
  })
  await requested(listPostsRemote, 4).refreshAll()
  return data
})

/**
 * Update a post.
 *
 * @group integration
 * @module posts
 */
export const updatePostRemote = command(
  object({ id: idSchema, values: postInputSchema }),
  async ({ id, values }) => {
    requirePermission('posts')
    const data = await updatePost(id, {
      ...values,
      coverImage: values.coverImage ?? null
    })
    await Promise.all([
      getPostRemote({ id }).refresh(),
      requested(listPostsRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Publish / unpublish a post (optimistic status flip from the list or
 * detail page).
 *
 * @group integration
 * @module posts
 */
export const setPostPublishedRemote = command(
  object({ id: idSchema, published: boolean() }),
  async ({ id, published }) => {
    requirePermission('posts')
    const data = await setPostPublished(id, published)
    await Promise.all([
      getPostRemote({ id }).refresh(),
      requested(listPostsRemote, 4).refreshAll()
    ])
    return data
  }
)

/**
 * Delete a post.
 *
 * @group integration
 * @module posts
 */
export const deletePostRemote = command(
  object({ id: idSchema }),
  async ({ id }) => {
    requirePermission('posts')
    await deletePost(id)
    await requested(listPostsRemote, 4).refreshAll()
  }
)
