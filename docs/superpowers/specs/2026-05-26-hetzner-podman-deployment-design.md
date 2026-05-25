# Hetzner Production Deployment (Podman Pod + Caddy)

**Date:** 2026-05-26
**Status:** Design — ready for plan
**Scope:** First-time productive deployment of `twincars-manager` **and** `twincars-website` on the Hetzner KVM `tc.ts13.de`, with self-hosted container registry and push-to-deploy.

## Goals

1. `https://tc.ts13.de/` serves the marketing website.
2. `https://tc.ts13.de/manager` serves the manager admin app (login → setup wizard → app).
3. `https://registry.tc.ts13.de/` hosts a private container registry; `podman push` from a developer machine triggers automatic redeploy on the server within ~2 minutes.
4. Postgres data persists across deploys and is backed up daily to the existing Hetzner Storagebox.
5. Both projects ship a `Dockerfile` so any developer with Docker or Podman can build the image locally and push it.
6. Server uses **Podman only** (no Docker). Systemd manages container lifecycle via **Quadlet** units.
7. Modern TLS, HSTS preload-ready, automatic Let's Encrypt — no manual cert handling.

## Non-goals

- Monitoring / alerting (Prometheus, Uptime-Kuma) — separate concern.
- CI/CD (Forgejo Actions, GitHub Actions) — manual `podman push` is the trigger for now.
- Outbound mail server on the host — manager-app reaches SMTP via the credentials its `/setup` wizard collects.
- Multi-replica / high availability — single VM, single replica.

## Architecture

### Pod topology

A single Podman pod named `twincars` contains five containers. The pod's infra container owns the network namespace; only ports 80 and 443 are published from the pod to the host.

```
                     ┌─────────────────────────────────────────────┐
                     │            Podman pod: twincars             │
                     │                                             │
  Internet ──:443──▶ │  caddy:2-alpine  ──┬──▶ localhost:3000 ─────┼──▶ manager (sveltekit)
                     │                    ├──▶ localhost:3001 ─────┼──▶ website (sveltekit)
                     │                    └──▶ localhost:5000 ─────┼──▶ registry:2
                     │                                             │
                     │                         localhost:5432 ◀────┼── postgres:18-alpine
                     └─────────────────────────────────────────────┘
```

All inter-container traffic happens over the shared pod loopback (`127.0.0.1`). Caddy is the only inbound surface.

### Component roles

| Container  | Image                                         | Listens on                     | Persistent volume                                                  |
| ---------- | --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `postgres` | `docker.io/library/postgres:18-alpine`        | `:5432`                        | `/srv/twincars/data/postgres`                                      |
| `manager`  | `registry.tc.ts13.de/twincars-manager:latest` | `:3000`                        | —                                                                  |
| `website`  | `registry.tc.ts13.de/twincars-website:latest` | `:3001`                        | —                                                                  |
| `registry` | `docker.io/library/registry:2`                | `:5000`                        | `/srv/twincars/data/registry`                                      |
| `caddy`    | `docker.io/library/caddy:2-alpine`            | `:80`, `:443` (host-published) | `/srv/twincars/data/caddy-data`, `/srv/twincars/data/caddy-config` |

Postgres pinned to major `18` (latest as of 2026-05). Minor versions update automatically via image-pull-on-restart. Major-version upgrades require a manual data migration and are out of scope.

### Quadlet units

All lifecycle managed via systemd Quadlet (Podman 4.4+). Files live under `/etc/containers/systemd/`:

- `twincars.pod` — declares the pod with `PublishPort=80:80` and `PublishPort=443:443`.
- `postgres.container` — sets env from `EnvironmentFile=/etc/twincars/env/postgres.env`, bind-mounts data, `Pod=twincars.pod`, `HealthCmd=pg_isready`.
- `manager.container` — env from `/etc/twincars/env/manager.env`, depends on postgres, labels `io.containers.autoupdate=registry`.
- `website.container` — env from `/etc/twincars/env/website.env` (PORT=3001), label `io.containers.autoupdate=registry`.
- `registry.container` — env from `/etc/twincars/env/registry.env` (REGISTRY_AUTH_HTPASSWD_PATH etc.), bind-mounts data and htpasswd.
- `caddy.container` — bind-mounts Caddyfile + data + config volumes, depends on the others.

Generated systemd units land in `/run/systemd/generator/` after `systemctl daemon-reload`. The pod auto-starts on boot.

### Routing (Caddyfile)

```caddy
{
  email admin@ts13.de
  servers { protocols h1 h2 h3 }
}

(security_headers) {
  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options    "nosniff"
    X-Frame-Options           "SAMEORIGIN"
    Referrer-Policy           "strict-origin-when-cross-origin"
    Permissions-Policy        "geolocation=(), microphone=(), camera=()"
    -Server
  }
}

tc.ts13.de {
  encode zstd gzip
  import security_headers

  @manager path /manager /manager/*
  handle @manager {
    reverse_proxy localhost:3000
  }
  handle {
    reverse_proxy localhost:3001
  }
}

registry.tc.ts13.de {
  encode zstd gzip
  import security_headers

  request_body { max_size 4GB }

  basic_auth /v2/* {
    deploy {{BCRYPT_HASH}}
  }
  reverse_proxy localhost:5000 {
    header_up X-Forwarded-Proto https
    header_up Host {host}
  }
}
```

Caddy's defaults already give TLS 1.3 + ECDHE + AEAD ciphers, OCSP stapling, ALPN, HTTP/3. No custom cipher list needed.

## Code changes

### `twincars-manager`

1. **`svelte.config.js`** — add `paths: { base: '/manager' }`:

   ```js
   kit: {
     adapter: adapter(),
     paths: { base: '/manager' },
     experimental: { remoteFunctions: true },
     alias: { /* unchanged */ }
   }
   ```

   SvelteKit prepends `/manager` to all client-side navigation, asset paths, and `goto` targets automatically. The CLAUDE.md rule "only `goto()` / `<a href>` for navigation" is already followed throughout the codebase, so no per-file changes are expected. Verified by spec-author by scanning for hard-coded absolute paths during plan-writing.

2. **`Dockerfile`** — no change needed (the existing one already runs `npm run build` and serves `node build` on `:3000`). The base-path is baked into the build at image-build time.

3. **`.env.example`** — add a comment block documenting which env vars Production sets versus dev. No new vars.

### `twincars-website`

1. **`Dockerfile`** — new file, simpler than the manager (no migrations, no `mdbtools`):

   ```dockerfile
   FROM node:lts-alpine AS build
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci
   COPY . .
   RUN npm run build && npm prune --omit=dev

   FROM node:lts-alpine AS runtime
   WORKDIR /app
   ENV NODE_ENV=production
   ENV PORT=3001
   COPY --from=build /app/build ./build
   COPY --from=build /app/node_modules ./node_modules
   COPY --from=build /app/package.json ./package.json
   EXPOSE 3001
   CMD ["node", "build"]
   ```

2. **`.dockerignore`** — new file: `node_modules`, `.svelte-kit`, `.env`, `.git`, `.playwright-mcp`, `tests-examples`, `tests`.

## Server filesystem layout

```
/etc/twincars/
  env/
    postgres.env          # POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_USER
    manager.env           # DATABASE_URL, APP_ENCRYPTION_KEY, ORIGIN, BODY_SIZE_LIMIT, PORT=3000, HOST=0.0.0.0
    website.env           # ORIGIN, PORT=3001, HOST=0.0.0.0
    registry.env          # REGISTRY_AUTH=htpasswd, REGISTRY_AUTH_HTPASSWD_REALM, REGISTRY_AUTH_HTPASSWD_PATH=/auth/htpasswd
  caddy/
    Caddyfile
  registry/
    htpasswd              # `htpasswd -Bbn deploy <pw>` output, mounted into registry container at /auth/htpasswd
  storagebox.key          # private key copied from local `ssh/twincars-manager`, chmod 600

/srv/twincars/data/
  postgres/               # bind mount → /var/lib/postgresql/data
  registry/               # bind mount → /var/lib/registry
  caddy-data/             # bind mount → /data (Let's Encrypt certs live here)
  caddy-config/           # bind mount → /config

/srv/twincars/backups/
  pg/                     # local copies of pg_dump output before rsync

/etc/containers/systemd/
  twincars.pod
  postgres.container
  manager.container
  website.container
  registry.container
  caddy.container

/usr/local/bin/
  twincars-backup-db.sh   # invoked by systemd timer or pre-deploy
  twincars-update.sh      # invoked by systemd timer

/etc/systemd/system/
  twincars-backup.service
  twincars-backup.timer
  twincars-update.service
  twincars-update.timer
```

All `/etc/twincars/env/*.env` and `/etc/twincars/storagebox.key` are mode `600`, owner `root:root`.

## Auto-deploy flow

```
developer machine                          server
─────────────────                          ──────
podman build -t \
  registry.tc.ts13.de/<image>:latest .
podman push registry.tc.ts13.de/<image>:latest ─▶ /v2/<image>/manifests/latest

                                          systemd: twincars-update.timer fires every 2 min
                                          ↓
                                          twincars-update.sh:
                                            1. podman auto-update --dry-run --format='{{.Updated}}'
                                            2. if any line == "true":
                                                 twincars-backup-db.sh --pre-deploy
                                                 podman auto-update
                                            3. else: exit
                                          ↓
                                          containers with new digest are restarted
                                          ↓
                                          manager container CMD = `node scripts/migrate.js && node build`
                                            → migrations run automatically on each restart
```

The `io.containers.autoupdate=registry` label opts a container in. Postgres, registry, and caddy stay on their pinned tags (no label), so they only update when the operator explicitly pulls — which is the right policy for stateful and infrastructure components.

## Backups

### Daily

`twincars-backup.timer` at `03:00` daily:

```sh
ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)
podman exec postgres pg_dump -U twincars twincars | gzip > /srv/twincars/backups/pg/${ts}.sql.gz
rsync -e "ssh -i /etc/twincars/storagebox.key -o StrictHostKeyChecking=accept-new" \
  /srv/twincars/backups/pg/${ts}.sql.gz \
  u589158@u589158.your-storagebox.de:/home/backups/postgres/

# retention
find /srv/twincars/backups/pg -name '*.sql.gz' -mtime +3 -delete
ssh -i /etc/twincars/storagebox.key u589158@u589158.your-storagebox.de \
  "find /home/backups/postgres -name '*.sql.gz' -mtime +14 -delete"
```

### Pre-deploy

Same script, but with filename suffix `_predeploy_<digest>` and local retention `+7 -delete`. Pre-deploy backups are uploaded to a separate folder `/home/backups/postgres-predeploy/` on the storagebox.

### Restore procedure (documented in the script header)

```sh
podman exec -i postgres psql -U twincars -d postgres -c "DROP DATABASE twincars; CREATE DATABASE twincars;"
gunzip -c <backup.sql.gz> | podman exec -i postgres psql -U twincars -d twincars
```

## Security

- **Firewall:** `ufw default deny incoming` + allow 22/tcp, 80/tcp, 443/tcp only.
- **sshd:** PasswordAuthentication=no, PermitRootLogin=prohibit-password (key already deployed). `fail2ban` with `[sshd]` jail enabled.
- **TLS:** Caddy default = TLS 1.3, ECDHE+(AES-GCM|ChaCha20-Poly1305). HTTP/3 (QUIC) enabled. HSTS 2-year + preload. (User submits both hostnames to hstspreload.org separately if desired — out of scope here.)
- **Secrets generation** (run once during provisioning, output captured to operator):
  - `POSTGRES_PASSWORD = $(openssl rand -hex 24)`
  - `APP_ENCRYPTION_KEY = $(openssl rand -hex 32)` — 64-char hex, used by `src/lib/server/crypto.ts` for AES-GCM.
  - Registry user `deploy`, password `$(openssl rand -base64 24)`, bcrypted via `htpasswd -Bbn`.
- **Registry exposure:** anonymous access denied for all paths under `/v2/` via Caddy `basic_auth`. The registry container itself runs in the pod with no published port — Caddy is the only path in.
- **Container privileges:** all containers run with default Podman security (UserNS=auto where supported, no `--privileged`).

## Manual steps before provisioning

1. **DNS:** add `A registry.tc.ts13.de 178.105.223.80`. Wait for propagation (typically <5 min).
2. **Operator captures secrets** that the provisioning run prints once:
   - `POSTGRES_PASSWORD`
   - `APP_ENCRYPTION_KEY`
   - Registry `deploy` password
   - Stored in operator's password manager. Server keeps them in `/etc/twincars/env/*.env` (mode 600) — re-readable if lost.
3. **Operator runs `podman login registry.tc.ts13.de`** on the developer machine after provisioning, with the printed `deploy` credentials. Credentials cached in `~/.config/containers/auth.json`.

## Validation plan

### Local pre-push

- `npm run check` — 0 errors, 0 warnings (both projects)
- `npm test` — green (both projects)
- `podman build` — both Dockerfiles succeed

### Server-side smoke (after provisioning)

- `systemctl status twincars-pod.service` — active, all containers up
- `curl -fsSI https://tc.ts13.de` → `200`, valid LE cert, HSTS header present
- `curl -fsSI https://tc.ts13.de/manager` → `200`, body contains the German setup-wizard or login text
- `curl -u deploy:<pw> -fsSI https://registry.tc.ts13.de/v2/` → `200`
- `podman push registry.tc.ts13.de/hello-world:test` from local dev → push completes
- Auto-update smoke: tag and push a no-op rebuild of `twincars-website:latest`. Within 2 min: `podman ps` shows website container with a fresh `Created` time, new image digest.
- Backup smoke: manually run `/usr/local/bin/twincars-backup-db.sh` — gz file appears locally and on storagebox.

### Playwright MCP

- Navigate to `https://tc.ts13.de` — website hero renders, no console errors, padlock green.
- Navigate to `https://tc.ts13.de/manager` — manager loads, setup wizard appears (or login if setup already done), all assets resolve under `/manager/`, no 404s in network tab.
- Navigate to `https://tc.ts13.de/manager/api/auth/get-session` — returns valid JSON (auth endpoint reachable).
- Lighthouse / dev-tools quick check on website: a11y and SEO pass with no critical violations.

## Risks & mitigations

| Risk                                                 | Mitigation                                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `paths.base = '/manager'` breaks something subtle    | Pre-deploy: run the manager locally with the patched config (`npm run dev` opens at `/manager/`) and smoke the main flows.                                  |
| Migration fails on auto-update; container crashloops | Pre-deploy `pg_dump`. Operator rolls back manually with `podman tag <previous-digest> <image>:latest && systemctl restart manager.service` and restores DB. |
| Registry push fills `/srv/twincars/data/registry`    | 75 GiB disk, registry blob storage is small (a few hundred MB per image). Documented in operator runbook; monitor `df -h /srv`.                             |
| Storagebox SSH key compromise                        | Key is scoped to a single storagebox user with no shell. Rotate via Hetzner panel if compromise suspected.                                                  |
| Caddy fails to renew cert                            | Caddy retries automatically. If acme challenge fails, fall back to `acme_dns` provider — not configured initially; out of scope.                            |
| Podman auto-update polls too often, hits rate limits | The registry is self-hosted, no rate limit. 2-min interval is fine.                                                                                         |

## Out-of-band one-time setup (post-design, pre-implementation)

The implementation plan will be split into discrete tasks (Dockerfile additions, code change, server provisioning script, Quadlet units, Caddyfile, backup script, update script, validation). The plan is written next.
