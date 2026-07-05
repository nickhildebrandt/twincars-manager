---
title: Operations - development environment
tags: [operations, dev, testing]
updated: 2026-07-05
---

# Development environment

## Requirements

Node >= 22, pnpm >= 11 via corepack (`packageManager: pnpm@11.8.0` -
never `npm install`, [[adr-012-pnpm-and-exact-pins]]), PostgreSQL >= 14,
optional `mdbtools` for the legacy import. `.env` (gitignored) needs
`DATABASE_URL` + `APP_SECRET`; template `.env.example`
([[environment-variables]]).

## Commands

```
pnpm dev            # Vite dev server http://localhost:5173
pnpm build          # adapter-node build into ./build
pnpm preview        # node build
pnpm check          # svelte-kit sync && svelte-check - must be 0/0
pnpm test           # Vitest single run (pg-mem - no live Postgres)
pnpm exec vitest run <pattern>   # single file / substring
pnpm db:generate | db:migrate | db:push | db:studio
pnpm format
node scripts/dev-mail-catcher.js # SMTP catcher on 127.0.0.1:1025 → tmp/mail/*.eml
```

Husky + lint-staged run Prettier on commit; never `--no-verify`.
Prettier: no semicolons, single quotes, no trailing comma, 2-space,
printWidth 80.

## Testing conventions

- Co-located `<file>.test.ts` next to source; Vitest +
  Testing-Library-Svelte, jsdom, `vitest.setup.ts`.
- DB tests run on **pg-mem** with the real migration chain applied -
  copy the `createTestDb` mock pattern from a neighboring test.
- Public-API tests: `vi.stubEnv('API_TOKENS', ...)` /
  `vi.unstubAllEnvs()` ([[public-rest-api]]).
- Mail tests mock the nodemailer transport ([[smtp-mail]]).
- Coverage: `pnpm test:cov` (v8).

## Live E2E (headless Playwright)

Playwright is NOT a repo dependency (agent tooling only). The Playwright
MCP in this dev environment is pinned to the Chrome channel and broken
(needs root). Working approach: drive `playwright-core` from the npx
cache against the cached chromium binary:

- lib: `$(ls -d ~/.npm/_npx/*/node_modules/playwright-core | head -1)/index.js`
  (CJS - default-import then `pw.chromium.launch(...)`)
- executable: `~/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome`
- `launch({ headless: true, executablePath })`

Login selectors and assertion tips: [[dashboard-and-login]]. Remember
the dev-only hydration recovery on async pages ([[known-constraints]])
when asserting immediately after navigation.

## Verification bar before "done"

`pnpm test` green, `pnpm exec svelte-check` 0 errors/0 warnings, and a
live walk of affected flows (dev server + headless browser). Frontend
changes are not done from tests alone (CLAUDE.md / CONTRIBUTING §13).
