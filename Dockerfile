# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────
# Builds the SvelteKit production output (`build/`) and prunes
# devDependencies for the runtime image. drizzle-kit stays here only
# because it's a devDependency used by `db:generate` during dev — it
# is NOT shipped to the runtime image.
FROM node:lts-slim AS build
WORKDIR /app

# Activate the pnpm shim shipped with corepack; the exact pnpm version is
# pinned via the `packageManager` field in package.json.
RUN corepack enable

# Cache deps before copying the rest so changes to source don't bust the
# install layer. pnpm-workspace.yaml carries the esbuild build-script
# approval. (.npmrc is gitignored / local-only, so it is intentionally not
# copied — a frozen-lockfile install does not need it.)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Build, then strip devDependencies (drizzle-kit included — the runtime
# uses only the drizzle-orm migrator, never drizzle-kit).
# `--ignore-scripts` on the prune: otherwise pnpm re-runs the root
# `prepare` script (svelte-kit sync / husky) AFTER the devDeps that
# provide those binaries have been removed, which fails the build.
RUN pnpm run build && pnpm prune --prod --ignore-scripts

# ─── Runtime stage ────────────────────────────────────────────────────
# Minimal image: only the built server, the migration runner, the
# generated SQL migrations, and the pruned production node_modules.
# `drizzle-kit` is gone; the runtime migrator from `drizzle-orm` is
# the only thing applying SQL in production.
FROM node:lts-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `mdbtools` is called by the import service (`/import`) for
# `mdb-export`. Without it, the Kfz-Kaufmann migration import fails.
RUN apt-get update \
  && apt-get install -y --no-install-recommends mdbtools \
  && rm -rf /var/lib/apt/lists/*

# adapter-node body limit set high so the KFZ-Kaufmann import (.mdb as
# base64, ~25 MB) doesn't bounce off the 512-KB default. All other
# endpoints take small JSON payloads — unaffected.
ENV BODY_SIZE_LIMIT=64M

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000

# Migrate first, then serve. `&&` short-circuits on migration failure
# (non-zero exit from scripts/migrate.js), so the app never starts
# against a half-migrated database.
#
# Backups are NOT handled in this container. The host / Postgres
# operations layer is responsible for snapshotting the database
# before deploying a new image with new migrations.
CMD ["sh", "-c", "node scripts/migrate.js && node build"]
