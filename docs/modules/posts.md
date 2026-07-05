---
title: Module - posts (Aktuelle Informationen)
tags: [module, posts, news]
updated: 2026-07-05
---

# posts - "Aktuelle Informationen" (news)

- **Purpose**: news articles the workshop publishes to its public
  website; drafts vs published, SEO-friendly slugs, cover images.
- **Routes**: `/posts`, `/posts/new`, `/posts/[id]`, `/posts/[id]/edit`.
- **Remote** `posts.remote.ts`: `listPostsRemote`, `getPostRemote`,
  `createPostRemote`, `updatePostRemote`, `setPostPublishedRemote`,
  `deletePostRemote`. Guard `requirePermission('posts')`.
- **Service**: `post-service.ts` - German-aware `slugify` (umlaut
  transliteration + collision suffixes), slug stays stable on edit,
  `publishedAt` set on first publish only, public read surface excludes
  drafts.
- **Tables**: `posts` (slug unique, `published` + `publishedAt` index,
  cover image jsonb `{mime, data}` validated to PNG/JPEG/WebP, ~5 MB cap
  via `ImageUploader`).
- **Public API**: `GET /api/public/posts` (paginated, published-only,
  newest first) and `GET /api/public/posts/[slug]` (404 for drafts) -
  [[public-rest-api]]. Website permalink shape: `/aktuelles/<slug>`.
- **Gotcha (fixed)**: the detail page must read
  `$derived(query.current ?? initial)` - a static `await query`
  snapshot broke the optimistic publish toggle (found by headless E2E,
  see [[dev-environment]]).
- **Tests**: `post-service.test.ts`, `posts.remote.test.ts`, public API
  cases in `public-api.test.ts`.
