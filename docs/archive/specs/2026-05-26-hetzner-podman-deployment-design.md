# Hetzner Production Deployment (Podman Pod + Caddy)

**Date:** 2026-05-26
**Status:** Design — ready for plan
**Scope:** First-time productive deployment of `twincars-manager` **and** `twincars-website` on the Hetzner KVM `tc.ts13.de`, with self-hosted container registry and push-to-deploy.

## Goals

1. `https://tc.ts13.de/` serves the marketing website.
2. `https://tc.ts13.de:5443/` serves the manager admin app (login → setup wizard → app).
3. `https://tc.ts13.de:5000/` hosts a private container registry (port-based, no extra DNS); `podman push` from a developer machine triggers automatic redeploy on the server within ~2 minutes.
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
  Internet ──:80─────▶ │  caddy:2-alpine  ──┬──▶ localhost:3001 ─────┼──▶ website  (sveltekit, root :443)
  Internet ──:443────▶ │                    ├──▶ localhost:3000 ─────┼──▶ manager  (sveltekit, on :5443)
  Internet ──:5443───▶ │                    └──▶ localhost:5001 ─────┼──▶ registry (registry:2, on :5000)
  Internet ──:5000───▶ │                                             │
                       │                         localhost:5432 ◀────┼── postgres:18-alpine
                       └─────────────────────────────────────────────┘
```

Caddy publishes four host ports (`:80`, `:443`, `:5000`, `:5443`) and serves the same `tc.ts13.de` Let's Encrypt certificate on all of them. Each port maps to a single backend by host:port matching in the Caddyfile.

The registry container runs internally on `:5001` (set via `REGISTRY_HTTP_ADDR=:5001`), not the conventional `:5000`. This frees `:5000` on the pod loopback for Caddy to publish externally, giving developers the standard-looking `tc.ts13.de:5000` push URL. The non-default internal port is invisible to users — only Caddy talks to the registry directly.

All inter-container traffic happens over the shared pod loopback (`127.0.0.1`). Caddy is the only inbound surface.

### Component roles

| Container  | Image                                     | Listens on                                       | Persistent volume                                                  |
| ---------- | ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `postgres` | `docker.io/library/postgres:18-alpine`    | `:5432`                                          | `/srv/twincars/data/postgres`                                      |
| `manager`  | `tc.ts13.de:5000/twincars-manager:latest` | `:3000`                                          | —                                                                  |
| `website`  | `tc.ts13.de:5000/twincars-website:latest` | `:3001`                                          | —                                                                  |
| `registry` | `docker.io/library/registry:2`            | `:5001` (internal)                               | `/srv/twincars/data/registry`                                      |
| `caddy`    | `docker.io/library/caddy:2-alpine`        | `:80`, `:443`, `:5000`, `:5443` (host-published) | `/srv/twincars/data/caddy-data`, `/srv/twincars/data/caddy-config` |

Postgres pinned to major `18` (latest as of 2026-05). Minor versions update automatically via image-pull-on-restart. Major-version upgrades require a manual data migration and are out of scope.

### Quadlet units

All lifecycle managed via systemd Quadlet (Podman 4.4+). Files live under `/etc/containers/systemd/`:

- `twincars.pod` — declares the pod with `PublishPort=80:80`, `PublishPort=443:443`, `PublishPort=5000:5000` (registry), `PublishPort=5443:5443` (manager).
- `postgres.container` — sets env from `EnvironmentFile=/etc/twincars/env/postgres.env`, bind-mounts data, `Pod=twincars.pod`, `HealthCmd=pg_isready`.
- `manager.container` — env from `/etc/twincars/env/manager.env`, depends on postgres, labels `io.containers.autoupdate=registry`.
- `website.container` — env from `/etc/twincars/env/website.env` (PORT=3001), label `io.containers.autoupdate=registry`.
- `registry.container` — env from `/etc/twincars/env/registry.env` (sets `REGISTRY_HTTP_ADDR=:5001`), bind-mounts data; no auth on the registry itself — Caddy enforces basic-auth in front.
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

# Marketing website — public root
tc.ts13.de {
  encode zstd gzip
  import security_headers
  reverse_proxy localhost:3001
}

# Manager admin app on the same hostname, different port. Same cert,
# zero code changes to the SvelteKit app (no base path, no rewrite).
tc.ts13.de:5443 {
  encode zstd gzip
  import security_headers
  reverse_proxy localhost:3000
}

# Registry on the same hostname, different port. Caddy uses the same
# Let's Encrypt cert for tc.ts13.de on all bound ports. Port 5000 is the
# Docker/Podman registry convention, so push commands look standard.
tc.ts13.de:5000 {
  encode zstd gzip
  import security_headers

  request_body { max_size 4GB }

  basic_auth /v2/* {
    deploy {{BCRYPT_HASH}}
  }
  reverse_proxy localhost:5001 {
    header_up X-Forwarded-Proto https
    header_up Host {host}
  }
}
```

Caddy's defaults already give TLS 1.3 + ECDHE + AEAD ciphers, OCSP stapling, ALPN, HTTP/3. No custom cipher list needed.

## Code changes

### `twincars-manager`

**No code changes.** The manager serves at `https://tc.ts13.de:5443/` — root-relative paths (`goto('/customers')`, `<a href="/customers">`) just work, no base-path migration needed. The existing `Dockerfile` already serves on `:3000` which Caddy proxies to.

The only documentation touch is **`.env.example`** — add a comment block listing which env vars Production sets versus dev (no new vars).

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
    registry.env          # REGISTRY_HTTP_ADDR=:5001 (internal port — see Caddy section); auth is enforced by Caddy in front, so the registry itself runs without REGISTRY_AUTH
  caddy/
    Caddyfile             # contains the bcrypt hash for the registry's `deploy` user inline; mode 600
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
  tc.ts13.de:5000/<image>:latest .
podman push tc.ts13.de:5000/<image>:latest ─▶ /v2/<image>/manifests/latest

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

- **Firewall:** `ufw default deny incoming` + allow 22/tcp, 80/tcp, 443/tcp, 5000/tcp, 5443/tcp only. Port 5000 is the registry (TLS, basic-auth via Caddy); port 5443 is the manager admin app (TLS via Caddy, auth via better-auth login).
- **sshd:** PasswordAuthentication=no, PermitRootLogin=prohibit-password (key already deployed). `fail2ban` with `[sshd]` jail enabled.
- **TLS:** Caddy default = TLS 1.3, ECDHE+(AES-GCM|ChaCha20-Poly1305). HTTP/3 (QUIC) enabled. HSTS 2-year + preload. (User submits both hostnames to hstspreload.org separately if desired — out of scope here.)
- **Secrets generation** (run once during provisioning, output captured to operator):
  - `POSTGRES_PASSWORD = $(openssl rand -hex 24)`
  - `APP_ENCRYPTION_KEY = $(openssl rand -hex 32)` — 64-char hex, used by `src/lib/server/crypto.ts` for AES-GCM.
  - Registry user `deploy`, password `$(openssl rand -base64 24)`, bcrypted via `caddy hash-password --plaintext '<pw>'` (or `htpasswd -Bnb deploy <pw>` and take the bcrypt segment) — the bcrypt string is pasted into the `basic_auth` block of the Caddyfile.
- **Registry exposure:** anonymous access denied for all paths under `/v2/` via Caddy `basic_auth`. The registry container itself runs in the pod with no published port — Caddy is the only path in.
- **Container privileges:** all containers run with default Podman security (UserNS=auto where supported, no `--privileged`).

## Manual steps before provisioning

1. **DNS:** nothing to do — `tc.ts13.de` already points to the server, registry rides on the same hostname via port `:5000`.
2. **Operator captures secrets** that the provisioning run prints once:
   - `POSTGRES_PASSWORD`
   - `APP_ENCRYPTION_KEY`
   - Registry `deploy` password
   - Stored in operator's password manager. Server keeps them in `/etc/twincars/env/*.env` (mode 600) — re-readable if lost.
3. **Operator runs `podman login tc.ts13.de:5000`** on the developer machine after provisioning, with the printed `deploy` credentials. Credentials cached in `~/.config/containers/auth.json`.

## Validation plan

### Local pre-push

- `npm run check` — 0 errors, 0 warnings (both projects)
- `npm test` — green (both projects)
- `podman build` — both Dockerfiles succeed

### Server-side smoke (after provisioning)

- `systemctl status twincars-pod.service` — active, all containers up
- `curl -fsSI https://tc.ts13.de` → `200`, valid LE cert, HSTS header present
- `curl -fsSI https://tc.ts13.de:5443/` → `200`, body contains the German setup-wizard or login text
- `curl -u deploy:<pw> -fsSI https://tc.ts13.de:5000/v2/` → `200`
- `curl -fsSI https://tc.ts13.de:5000/v2/` (without credentials) → `401`
- `podman push tc.ts13.de:5000/hello-world:test` from local dev → push completes
- Auto-update smoke: tag and push a no-op rebuild of `twincars-website:latest`. Within 2 min: `podman ps` shows website container with a fresh `Created` time, new image digest.
- Backup smoke: manually run `/usr/local/bin/twincars-backup-db.sh` — gz file appears locally and on storagebox.

### Playwright MCP

- Navigate to `https://tc.ts13.de` — website hero renders, no console errors, padlock green.
- Navigate to `https://tc.ts13.de:5443/` — manager loads, setup wizard appears (or login if setup already done), all assets resolve, no 404s in network tab.
- Navigate to `https://tc.ts13.de:5443/api/auth/get-session` — returns valid JSON (auth endpoint reachable).
- Lighthouse / dev-tools quick check on website: a11y and SEO pass with no critical violations.

## Risks & mitigations

| Risk                                                    | Mitigation                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-standard port `:5443` blocked by corporate networks | Acceptable for internal admin tool; operator bookmarks URL with port. Future: move to subdomain once DNS allows.                                            |
| Migration fails on auto-update; container crashloops    | Pre-deploy `pg_dump`. Operator rolls back manually with `podman tag <previous-digest> <image>:latest && systemctl restart manager.service` and restores DB. |
| Registry push fills `/srv/twincars/data/registry`       | 75 GiB disk, registry blob storage is small (a few hundred MB per image). Documented in operator runbook; monitor `df -h /srv`.                             |
| Storagebox SSH key compromise                           | Key is scoped to a single storagebox user with no shell. Rotate via Hetzner panel if compromise suspected.                                                  |
| Caddy fails to renew cert                               | Caddy retries automatically. If acme challenge fails, fall back to `acme_dns` provider — not configured initially; out of scope.                            |
| Podman auto-update polls too often, hits rate limits    | The registry is self-hosted, no rate limit. 2-min interval is fine.                                                                                         |

## Out-of-band one-time setup (post-design, pre-implementation)

The implementation plan will be split into discrete tasks (Dockerfile additions, code change, server provisioning script, Quadlet units, Caddyfile, backup script, update script, validation). The plan is written next.
