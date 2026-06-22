/**
 * Handler implementation for `GET /api/public/posts/:slug`.
 *
 * Returns one published post by its slug wrapped in a `{ post }`
 * envelope. 404 when the slug is unknown or the post is still a draft
 * (drafts are indistinguishable from "not found" to public consumers).
 *
 * @group integration
 * @module public-api
 */
import type { RequestEvent } from '@sveltejs/kit'
import {
  parse,
  pipe,
  string,
  trim,
  minLength,
  maxLength,
  ValiError
} from 'valibot'
import { fail, ok } from '$lib/server/public-api'
import { getPublicPostBySlug } from '$lib/server/services/post-service'
import { toPublicPost } from '../endpoint'

const slugSchema = pipe(
  string(),
  trim(),
  minLength(1, 'slug must not be empty.'),
  maxLength(220, 'slug is too long.')
)

export async function handlePublicPostDetail(
  event: RequestEvent
): Promise<Response> {
  let slug: string
  try {
    slug = parse(slugSchema, event.params.slug ?? '')
  } catch (err) {
    if (err instanceof ValiError) {
      fail(400, err.issues[0].message)
    }
    throw err
  }
  const row = await getPublicPostBySlug(slug)
  if (!row) {
    fail(404, 'Post not found.')
  }
  return ok({ post: toPublicPost(row) })
}
