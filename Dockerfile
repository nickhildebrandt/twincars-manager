# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────
# Builds the SvelteKit production output (`build/`) and prunes
# devDependencies for the runtime image. drizzle-kit stays here only
# because it's a devDependency used by `db:generate` during dev — it
# is NOT shipped to the runtime image.
FROM node:lts-alpine AS build
WORKDIR /app

# Cache deps before copying the rest so changes to source don't bust
# the npm-install layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────
# Minimal image: only the built server, the migration runner, the
# generated SQL migrations, and the pruned production node_modules.
# `drizzle-kit` is gone; the runtime migrator from `drizzle-orm` is
# the only thing applying SQL in production.
FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `mdbtools` wird vom Import-Service (`/import`) für `mdb-export`
# aufgerufen. Ohne dieses Paket schlägt der Migrations-Import aus
# KFZ-Kaufmann fehl. Klein genug, dass es das Image nicht aufbläht.
RUN apk add --no-cache mdbtools

# adapter-node Body-Limit hochsetzen, damit der KFZ-Kaufmann-Import
# (.mdb als base64, ~25 MB) nicht am 512-KB-Default abprallt. Alle
# anderen Endpunkte arbeiten mit kleinen JSON-Payloads, die hierdurch
# nicht beeinflusst werden.
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
