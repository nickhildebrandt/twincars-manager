---
title: Operations - fresh database reset runbook
tags: [operations, database, runbook]
updated: 2026-07-05
---

# Fresh-DB reset runbook

## Production (done for go-live 2026-06-22)

1. Take a predeploy backup ([[backup-and-restore]]).
2. `systemctl stop manager.service`.
3. `podman exec -i postgres psql -U twincars -d postgres -c "DROP DATABASE twincars; CREATE DATABASE twincars;"`
4. `systemctl start manager.service` - the container CMD applies ALL
   migrations (0000..current) before serving.
5. Verify: `/` redirects to `/setup`; complete the wizard ([[setup]]) to
   create the first admin; public API rejects bad tokens with 401.

## Local dev

The dev role (`admin` in the default `DATABASE_URL`) does NOT own schema
`public`, so `DROP SCHEMA public CASCADE` is denied. Use instead:

```sh
set -a; . ./.env; set +a
node -e "import('postgres').then(async ({default:p})=>{const s=p(process.env.DATABASE_URL,{max:1});await s.unsafe('DROP OWNED BY current_user CASCADE');await s.end()})"
pnpm db:migrate
```

Then `pnpm dev` - the first request seeds defaults and `/` redirects to
`/setup`.

## Why this exists

The local dev DB once drifted from the migration journal (25 recorded,
tires tables missing, stale `item_photos`), so `db:migrate` failed at 0026. Recreating is the sanctioned fix; hand-editing
`__drizzle_migrations` is not. Migrations are idempotent by convention
(`IF NOT EXISTS` guards) to survive most drift without this - see
[[database-schema]].
