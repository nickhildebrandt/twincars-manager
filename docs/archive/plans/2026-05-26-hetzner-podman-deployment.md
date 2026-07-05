# Hetzner Podman Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `tc.ts13.de` to production: marketing website at `https://tc.ts13.de/`, manager admin app at `https://tc.ts13.de:5443/`, self-hosted Podman container registry at `https://tc.ts13.de:5000/` with push-to-deploy, daily DB backups to Hetzner Storagebox.

**Architecture:** Single Podman pod (PostgreSQL + manager + website + registry + Caddy) on Debian 13, lifecycle via systemd Quadlet. Caddy publishes :80/:443/:5000/:5443 and serves the same Let's Encrypt certificate for `tc.ts13.de` on all four ports. Push to the on-host registry triggers `podman auto-update` within ~2 minutes, with a pre-deploy `pg_dump` snapshot.

**Tech Stack:** Debian 13 (trixie), Podman 5.x + Quadlet, Caddy 2.x, PostgreSQL 18-alpine, distribution/registry:2, SvelteKit (Node 22 runtime), ufw, fail2ban.

**Reference:** [Design spec](../specs/2026-05-26-hetzner-podman-deployment-design.md).

---

## File structure

### Local repo touches

```
/home/nick/tc/twincars-website/
  Dockerfile               # new
  .dockerignore            # new

/home/nick/tc/twincars-manager/
  .env.example             # modify (comment additions only)
  deploy/
    README.md              # new — operator runbook
    Caddyfile.tmpl         # new — has {{BCRYPT_HASH}} placeholder
    quadlet/
      twincars.pod         # new
      postgres.container   # new
      manager.container    # new
      website.container    # new
      registry.container   # new
      caddy.container      # new
    env-templates/
      registry.env         # new (no secrets, copied as-is)
    systemd/
      twincars-backup.service  # new
      twincars-backup.timer    # new
      twincars-update.service  # new
      twincars-update.timer    # new
    scripts/
      provision.sh         # new — one-shot server bootstrap, idempotent
      backup-db.sh         # new — daily + pre-deploy backups
      update.sh            # new — poll registry, snapshot, auto-update
```

### Server-side filesystem (produced by provision.sh)

```
/etc/twincars/
  env/{postgres,manager,website,registry}.env   mode 600
  caddy/Caddyfile                               mode 600 (contains bcrypt hash)
  storagebox.key                                mode 600
  secrets.firstrun.txt                          mode 600 (printed once)
  registry.deploy.pw                            mode 600 (plaintext, for reference)

/srv/twincars/data/{postgres,registry,caddy-data,caddy-config}/
/srv/twincars/backups/pg/

/etc/containers/systemd/                        # quadlet drops generated units in /run/systemd/generator/
  twincars.pod
  postgres.container
  manager.container
  website.container
  registry.container
  caddy.container

/usr/local/bin/
  twincars-backup-db.sh
  twincars-update.sh

/etc/systemd/system/
  twincars-backup.service + .timer
  twincars-update.service + .timer
```

---

## Phase 1: Local code changes

### Task 1: Add Dockerfile and .dockerignore to twincars-website

**Files:**

- Create: `/home/nick/tc/twincars-website/Dockerfile`
- Create: `/home/nick/tc/twincars-website/.dockerignore`
- Initialize git: `/home/nick/tc/twincars-website/.git/` (local only, no remote)

The website's `config.ts` and `robots.txt/+server.ts` consume `TC_MANAGER_API_URL`, `TC_MANAGER_API_TOKEN`, and `PUBLIC_SITE_URL` at build time (the first two via `requireEnv` at module load, the third via `$env/static/public` inlining). The Dockerfile passes safe defaults through `ARG`/`ENV` so the build can complete; runtime values come from `website.env`. The project's `.npmrc` (`legacy-peer-deps=true`) must reach the build context — vite-plugin-svelte's peer-range otherwise breaks `npm ci`.

- [ ] **Step 1: Create the Dockerfile**

Write to `/home/nick/tc/twincars-website/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────
FROM node:lts-alpine AS build
WORKDIR /app

# Build-time placeholders. Runtime values are supplied via website.env
# inside the pod; these defaults exist only so `vite build` and the
# SvelteKit `analyse` step can complete.
ARG PUBLIC_SITE_URL=https://tc.ts13.de
ARG TC_MANAGER_API_URL=http://localhost:3000
ARG TC_MANAGER_API_TOKEN=placeholder-build-token
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL
ENV TC_MANAGER_API_URL=$TC_MANAGER_API_URL
ENV TC_MANAGER_API_TOKEN=$TC_MANAGER_API_TOKEN

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# ─── Runtime stage ────────────────────────────────────────────────────
FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3001

CMD ["node", "build"]
```

- [ ] **Step 2: Create the .dockerignore**

Write to `/home/nick/tc/twincars-website/.dockerignore` (note: `.npmrc` is intentionally NOT listed — the build needs it):

```
node_modules
.svelte-kit
build
.env
.env.local
.git
.gitignore
.prettierrc
.prettierignore
.vscode
.idea
coverage
playwright-report
test-results
tests-examples
tests
*.log
README.md
```

- [ ] **Step 3: Initialize git in the website repo**

The website directory has a `.gitignore` but is not yet a git repo:

```bash
cd /home/nick/tc/twincars-website
git init -b main
git add .
git commit -m "chore: initial commit (existing source baseline)"
```

This commit covers the pre-existing source. The next commit (Step 6) will add only the Dockerfile + .dockerignore.

- [ ] **Step 4: Build the image locally to verify it works**

Run from `/home/nick/tc/twincars-website/`:

```bash
cd /home/nick/tc/twincars-website
podman build -t twincars-website:test .
# OR if podman is unavailable on the dev machine:
docker build --network=host -t twincars-website:test .
```

Expected: build succeeds, ends with `Successfully tagged localhost/twincars-website:test` (podman) or `naming to docker.io/library/twincars-website:test done` (docker).

If you used `docker`, the `--network=host` flag works around this dev machine's broken bridge DNS — it is not needed on the deploy server.

- [ ] **Step 5: Quick container smoke run**

```bash
podman run --rm -d --name web-smoke -p 13001:3001 twincars-website:test
# OR with docker:
docker run --rm -d --name web-smoke -p 13001:3001 twincars-website:test

sleep 3
curl -fsSI http://127.0.0.1:13001/ | head -5
podman stop web-smoke    # or: docker stop web-smoke
```

Expected: HTTP/1.1 200, valid HTML returned. If the smoke fails, fix the image before continuing.

- [ ] **Step 6: Commit the Docker files**

```bash
cd /home/nick/tc/twincars-website
git add Dockerfile .dockerignore
git commit -m "build: add Dockerfile and .dockerignore for production image"
```

---

### Task 2: Document Production env vars in twincars-manager/.env.example

**Files:**

- Modify: `/home/nick/tc/twincars-manager/.env.example`

- [ ] **Step 1: Read the current .env.example to understand the format**

```bash
cat /home/nick/tc/twincars-manager/.env.example
```

- [ ] **Step 2: Append a "Production" comment block at the bottom**

Append (do **not** replace existing content) the following lines to `/home/nick/tc/twincars-manager/.env.example`:

```
# ─────────────────────────────────────────────────────────────────────
# Production note (tc.ts13.de)
#
# In production these are set on the host in /etc/twincars/env/manager.env
# (mode 600, root-owned) by `deploy/scripts/provision.sh` — do NOT commit
# real values to this repo. The provisioning script generates
# APP_ENCRYPTION_KEY and the Postgres password once, prints them to the
# operator, and stores them on the server only.
#
# Production additionally sets:
#   ORIGIN=https://tc.ts13.de:5443
#   BODY_SIZE_LIMIT=67108864   (64 MiB, for the legacy .mdb import)
#   HOST=0.0.0.0
#   PORT=3000
# ─────────────────────────────────────────────────────────────────────
```

- [ ] **Step 3: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add .env.example
git commit -m "docs: document production env-var origin in .env.example"
```

---

## Phase 2: Author deploy artifacts

### Task 3: Create deploy/ tree and README

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/README.md`

- [ ] **Step 1: Create the directory tree**

```bash
cd /home/nick/tc/twincars-manager
mkdir -p deploy/{quadlet,env-templates,systemd,scripts}
```

- [ ] **Step 2: Write the operator README**

Write to `/home/nick/tc/twincars-manager/deploy/README.md`:

````markdown
# TwinCars deployment — `tc.ts13.de`

Operator runbook for the Hetzner KVM hosting both the marketing website
and the manager admin app behind Caddy + a self-hosted Podman registry.

See [`docs/superpowers/specs/2026-05-26-hetzner-podman-deployment-design.md`](../docs/superpowers/specs/2026-05-26-hetzner-podman-deployment-design.md)
for the design rationale.

## Topology

| URL                          | Backend  |
| ---------------------------- | -------- |
| `https://tc.ts13.de/`        | website  |
| `https://tc.ts13.de:5443/`   | manager  |
| `https://tc.ts13.de:5000/v2` | registry |

All five containers run inside one Podman pod (`twincars`) lifecycle-managed
by systemd Quadlet. Only Caddy publishes ports to the host.

## First-time bootstrap

From your dev machine, with the SSH key in `ssh/twincars-manager`:

```bash
SERVER=root@tc.ts13.de
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager

# 1. Pre-create /etc/twincars on the server (mode 0700)
ssh -i $KEY $SERVER 'install -d -m 0700 /etc/twincars'

# 2. Upload the storagebox SSH key (used by backups)
scp -i $KEY ssh/twincars-manager $SERVER:/etc/twincars/storagebox.key
ssh -i $KEY $SERVER 'chmod 600 /etc/twincars/storagebox.key'

# 3. Rsync the deploy directory
rsync -e "ssh -i $KEY" -av --delete deploy/ $SERVER:/opt/twincars-deploy/

# 4. Run provisioning
ssh -i $KEY -t $SERVER 'bash /opt/twincars-deploy/scripts/provision.sh'

# Copy the printed secrets into your password manager — they are also
# saved on the server at /etc/twincars/secrets.firstrun.txt (mode 600).
```

## Pushing a new image (deploy)

From any machine that has `podman` (or `docker`) + the registry credentials:

```bash
podman login tc.ts13.de:5000          # one-time, creds in ~/.config/containers/auth.json

# Manager
cd /home/nick/tc/twincars-manager
podman build -t tc.ts13.de:5000/twincars-manager:latest .
podman push   tc.ts13.de:5000/twincars-manager:latest

# Website
cd /home/nick/tc/twincars-website
podman build -t tc.ts13.de:5000/twincars-website:latest .
podman push   tc.ts13.de:5000/twincars-website:latest
```

Within ~2 minutes the server's `twincars-update.timer` picks up the new
manifest digest, takes a `pg_dump` snapshot (if migrations are involved),
and restarts the changed containers.

To force an immediate update without waiting for the timer:

```bash
ssh -i $KEY $SERVER 'systemctl start twincars-update.service'
```

## Operational commands

```bash
# Pod state
ssh -i $KEY $SERVER 'systemctl list-units twincars-* postgres.service manager.service website.service caddy.service registry.service'

# Logs for one container
ssh -i $KEY $SERVER 'journalctl -u manager.service -e --no-pager -n 200'

# Manual backup (also lands on storagebox)
ssh -i $KEY $SERVER '/usr/local/bin/twincars-backup-db.sh daily'

# Rollback to a previous image digest
ssh -i $KEY $SERVER 'podman tag tc.ts13.de:5000/twincars-manager@sha256:<digest> tc.ts13.de:5000/twincars-manager:latest && systemctl restart manager.service'
```

## Restore from backup

```bash
gunzip -c <backup.sql.gz> | ssh -i $KEY $SERVER 'podman exec -i postgres psql -U twincars -d twincars'
```

(Drop + recreate the database first if you want a clean slate.)
````

- [ ] **Step 3: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/README.md
git commit -m "deploy: add operator runbook for tc.ts13.de"
```

---

### Task 4: Author the Caddyfile template

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/Caddyfile.tmpl`

- [ ] **Step 1: Write the Caddyfile.tmpl**

Write to `/home/nick/tc/twincars-manager/deploy/Caddyfile.tmpl`:

```caddy
# Caddyfile for tc.ts13.de
# This is a TEMPLATE — provision.sh substitutes {{BCRYPT_HASH}} with the
# bcrypt-hashed registry deploy-user password and writes the result to
# /etc/twincars/caddy/Caddyfile (mode 600).

{
	email admin@ts13.de
	servers {
		protocols h1 h2 h3
	}
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

# Marketing website — public root on the standard ports.
tc.ts13.de {
	encode zstd gzip
	import security_headers
	reverse_proxy localhost:3001
}

# Manager admin app on the same hostname, different port (same cert).
tc.ts13.de:5443 {
	encode zstd gzip
	import security_headers

	# Large body limit for the legacy .mdb import endpoint.
	request_body {
		max_size 64MB
	}

	reverse_proxy localhost:3000 {
		# Pass the original scheme so SvelteKit generates https:// URLs.
		header_up X-Forwarded-Proto https
	}
}

# Container registry on the same hostname, port 5000 (registry convention).
tc.ts13.de:5000 {
	encode zstd gzip
	import security_headers

	# 4 GB push limit — accommodates large image layers.
	request_body {
		max_size 4GB
	}

	basic_auth /v2/* {
		deploy {{BCRYPT_HASH}}
	}

	reverse_proxy localhost:5001 {
		header_up X-Forwarded-Proto https
		header_up Host {host}
	}
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/Caddyfile.tmpl
git commit -m "deploy: add Caddyfile template (TLS, HSTS, multi-port, registry basic_auth)"
```

---

### Task 5: Author Quadlet pod and container units

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/twincars.pod`
- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/postgres.container`
- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/manager.container`
- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/website.container`
- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/registry.container`
- Create: `/home/nick/tc/twincars-manager/deploy/quadlet/caddy.container`

- [ ] **Step 1: Write the pod definition**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/twincars.pod`:

```ini
# Quadlet generates twincars-pod.service from this file.
# All container units that set `Pod=twincars.pod` join this pod and share
# its network namespace; therefore all inter-container traffic is over the
# pod's shared loopback (127.0.0.1).

[Unit]
Description=TwinCars production pod
Wants=network-online.target
After=network-online.target

[Pod]
PodName=twincars
PublishPort=80:80
PublishPort=443:443
PublishPort=5000:5000
PublishPort=5443:5443

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 2: Write postgres.container**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/postgres.container`:

```ini
[Unit]
Description=PostgreSQL 18 for TwinCars
Requires=twincars-pod.service
After=twincars-pod.service

[Container]
Image=docker.io/library/postgres:18-alpine
Pod=twincars.pod
ContainerName=postgres
EnvironmentFile=/etc/twincars/env/postgres.env
Volume=/srv/twincars/data/postgres:/var/lib/postgresql/data:Z
HealthCmd=pg_isready -U twincars -d twincars
HealthInterval=10s
HealthRetries=5
HealthStartPeriod=30s
# No PublishPort — only reachable on the pod's shared loopback.

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 3: Write manager.container**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/manager.container`:

```ini
[Unit]
Description=TwinCars manager (SvelteKit)
Requires=twincars-pod.service postgres.service
After=twincars-pod.service postgres.service

[Container]
Image=tc.ts13.de:5000/twincars-manager:latest
Pod=twincars.pod
ContainerName=manager
EnvironmentFile=/etc/twincars/env/manager.env
Label=io.containers.autoupdate=registry
AuthFile=/root/.config/containers/auth.json
# Pull policy: pull missing on first start; auto-update handles re-pulls.
Pull=missing
HealthCmd=wget --quiet --spider http://127.0.0.1:3000/
HealthInterval=15s
HealthRetries=4
HealthStartPeriod=60s

[Service]
Restart=always
RestartSec=10
# First start may fail until the image is pushed to the registry — that's OK,
# Restart=always will keep retrying.
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 4: Write website.container**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/website.container`:

```ini
[Unit]
Description=TwinCars marketing website (SvelteKit)
Requires=twincars-pod.service
After=twincars-pod.service

[Container]
Image=tc.ts13.de:5000/twincars-website:latest
Pod=twincars.pod
ContainerName=website
EnvironmentFile=/etc/twincars/env/website.env
Label=io.containers.autoupdate=registry
AuthFile=/root/.config/containers/auth.json
Pull=missing
HealthCmd=wget --quiet --spider http://127.0.0.1:3001/
HealthInterval=15s
HealthRetries=4
HealthStartPeriod=60s

[Service]
Restart=always
RestartSec=10
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 5: Write registry.container**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/registry.container`:

```ini
[Unit]
Description=Container registry (Docker registry:2) for TwinCars
Requires=twincars-pod.service
After=twincars-pod.service

[Container]
Image=docker.io/library/registry:2
Pod=twincars.pod
ContainerName=registry
EnvironmentFile=/etc/twincars/env/registry.env
Volume=/srv/twincars/data/registry:/var/lib/registry:Z
HealthCmd=wget --quiet --spider http://127.0.0.1:5001/v2/
HealthInterval=30s
HealthRetries=4
HealthStartPeriod=15s

[Service]
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 6: Write caddy.container**

Write to `/home/nick/tc/twincars-manager/deploy/quadlet/caddy.container`:

```ini
[Unit]
Description=Caddy reverse proxy + auto-SSL
Requires=twincars-pod.service registry.service
After=twincars-pod.service registry.service postgres.service

[Container]
Image=docker.io/library/caddy:2-alpine
Pod=twincars.pod
ContainerName=caddy
Volume=/etc/twincars/caddy/Caddyfile:/etc/caddy/Caddyfile:ro,Z
Volume=/srv/twincars/data/caddy-data:/data:Z
Volume=/srv/twincars/data/caddy-config:/config:Z
HealthCmd=wget --quiet --spider http://127.0.0.1/
HealthInterval=30s
HealthRetries=4
HealthStartPeriod=60s

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target default.target
```

- [ ] **Step 7: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/quadlet/
git commit -m "deploy: add Quadlet units for pod + 5 containers"
```

---

### Task 6: Author the static env-template files

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/env-templates/registry.env`

Only `registry.env` is static (no secrets). The other env files are generated by `provision.sh` because they need the freshly minted secrets.

- [ ] **Step 1: Write registry.env**

Write to `/home/nick/tc/twincars-manager/deploy/env-templates/registry.env`:

```
# distribution/registry:2 configuration.
# Internal listen address is :5001 so Caddy can publish :5000 on the pod
# loopback without colliding. Auth is enforced by Caddy in front (basic_auth);
# the registry itself is open inside the pod.

REGISTRY_HTTP_ADDR=:5001
REGISTRY_STORAGE_DELETE_ENABLED=true
REGISTRY_HTTP_HEADERS_X_Content_Type_Options=[nosniff]
```

- [ ] **Step 2: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/env-templates/registry.env
git commit -m "deploy: add static registry.env template"
```

---

### Task 7: Author the backup-db.sh script

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/scripts/backup-db.sh`

- [ ] **Step 1: Write the backup script**

Write to `/home/nick/tc/twincars-manager/deploy/scripts/backup-db.sh`:

**Storagebox constraints (important):**

- Hetzner Storagebox port 22 = SFTP/scp/borg subsystems only (no arbitrary `ssh exec`).
- Port 23 = custom restricted shell. Supports: `ls`, `mkdir`, `rm`, `cat`, `head`, `tail`, `grep`, `stat`, `du`, `df`, `md5sum`, `sha*sum`, `version`. **No `find`, no `xargs`, no shell pipes/redirects.** One command per ssh invocation.
- rsync uses its own protocol over `ssh -p 23`, so uploads work normally.
- Remote retention therefore: `ls` the directory, filter filenames locally by their ISO-8601 timestamp prefix vs. a computed cutoff, then issue a single batched `rm` with all stale paths.

```bash
#!/usr/bin/env bash
# /usr/local/bin/twincars-backup-db.sh
#
# Take a `pg_dump` of the running Postgres container, gzip it, drop it under
# /srv/twincars/backups/pg/, and rsync it to the Hetzner Storagebox.
#
# Usage: twincars-backup-db.sh [daily|predeploy]
#   daily     — invoked by the systemd timer, retained 3 d local / 14 d remote
#   predeploy — invoked by twincars-update.sh before podman auto-update,
#               retained 7 d local / 7 d remote, separate remote folder
#
# Hetzner Storagebox notes:
#   - Port 22: SFTP/scp/borg subsystems only — no arbitrary exec.
#   - Port 23: custom restricted shell. Supports: ls, mkdir, rm, cat, head,
#     tail, grep, stat, du, df, md5/sha*sum, version. NO find, NO xargs,
#     NO shell pipes/redirects, one command per ssh invocation.
#   - rsync works via `-e "ssh -p 23 ..."` (rsync uses its own protocol).

set -euo pipefail

mode="${1:-daily}"
ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)
local_dir=/srv/twincars/backups/pg
SSHK=/etc/twincars/storagebox.key
SSHU="u589158@u589158.your-storagebox.de"
SSHP=23
SSHO="-p ${SSHP} -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o IdentitiesOnly=yes"

case "$mode" in
  daily)
    suffix=""
    remote_dir=/home/backups/postgres
    local_keep_days=3
    remote_keep_days=14
    ;;
  predeploy)
    suffix="_predeploy"
    remote_dir=/home/backups/postgres-predeploy
    local_keep_days=7
    remote_keep_days=7
    ;;
  *)
    echo "usage: $0 [daily|predeploy]" >&2
    exit 1
    ;;
esac

mkdir -p "$local_dir"
out="${local_dir}/${ts}${suffix}.sql.gz"

echo "[$(date -Is)] backup-db: dumping into $out"
podman exec postgres pg_dump -U twincars -d twincars | gzip -9 > "$out"

bytes=$(stat -c %s "$out")
echo "[$(date -Is)] backup-db: wrote ${bytes} bytes"

if [[ -f "$SSHK" ]]; then
  echo "[$(date -Is)] backup-db: uploading to ${SSHU}:${remote_dir}/"
  ssh -i "$SSHK" $SSHO "$SSHU" "mkdir ${remote_dir}" || true
  rsync -e "ssh -i $SSHK $SSHO" "$out" "${SSHU}:${remote_dir}/"

  echo "[$(date -Is)] backup-db: remote retention (keep ${remote_keep_days}d)"
  # Storagebox restricted shell has no `find`, so we list, filter locally,
  # then issue a single `rm` with all stale paths.
  cutoff=$(date -u -d "${remote_keep_days} days ago" +%Y-%m-%dT%H-%M-%SZ)
  remote_files=$(ssh -i "$SSHK" $SSHO "$SSHU" "ls ${remote_dir}" || true)
  to_delete=()
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if [[ "$mode" == "daily" ]]; then
      [[ "$f" == *_predeploy.sql.gz ]] && continue
      [[ "$f" != *.sql.gz ]] && continue
      name_ts="${f%.sql.gz}"
    else
      [[ "$f" != *_predeploy.sql.gz ]] && continue
      name_ts="${f%_predeploy.sql.gz}"
    fi
    if [[ "$name_ts" < "$cutoff" ]]; then
      to_delete+=("${remote_dir}/$f")
    fi
  done <<< "$remote_files"

  if (( ${#to_delete[@]} > 0 )); then
    echo "[$(date -Is)] backup-db: deleting ${#to_delete[@]} stale remote file(s)"
    ssh -i "$SSHK" $SSHO "$SSHU" "rm ${to_delete[*]}" || true
  fi
else
  echo "[$(date -Is)] backup-db: storagebox key not present, skipping upload"
fi

echo "[$(date -Is)] backup-db: local retention (keep ${local_keep_days}d)"
if [[ "$mode" == "daily" ]]; then
  # delete daily backups older than N days, but NEVER touch *_predeploy.sql.gz here
  find "$local_dir" -maxdepth 1 -name '*.sql.gz' -not -name '*_predeploy.sql.gz' -mtime +${local_keep_days} -delete
else
  find "$local_dir" -maxdepth 1 -name '*_predeploy.sql.gz' -mtime +${local_keep_days} -delete
fi

echo "[$(date -Is)] backup-db: done"
```

- [ ] **Step 2: Make the file executable in git**

```bash
chmod +x /home/nick/tc/twincars-manager/deploy/scripts/backup-db.sh
```

- [ ] **Step 3: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/scripts/backup-db.sh
git commit -m "deploy: add backup-db.sh (daily + predeploy modes, storagebox upload)"
```

---

### Task 8: Author the update.sh script

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/scripts/update.sh`

- [ ] **Step 1: Write the update script**

Write to `/home/nick/tc/twincars-manager/deploy/scripts/update.sh`:

```bash
#!/usr/bin/env bash
# /usr/local/bin/twincars-update.sh
#
# Invoked by twincars-update.timer every 2 minutes.
# 1. Ask podman auto-update which labeled containers have a newer manifest.
# 2. If any do, take a pre-deploy pg_dump snapshot.
# 3. Run `podman auto-update` to pull + restart the changed containers.

set -euo pipefail

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

log() { printf '[%s] update: %s\n' "$(date -Is)" "$*"; }

# --dry-run --format='{{.Updated}}' prints one line per labeled container,
# value "true" if the registry manifest differs from the local one.
# Podman ≥ 4.4 supports this. We tolerate transient registry errors (the
# next timer tick will retry).
updates_output=$(podman auto-update --dry-run --format '{{.Updated}}' 2>&1 || true)

if echo "$updates_output" | grep -qx 'true'; then
  log "manifest difference detected, taking pre-deploy DB snapshot"
  /usr/local/bin/twincars-backup-db.sh predeploy
  log "running podman auto-update"
  podman auto-update
  log "auto-update complete"
else
  # Don't log "no updates" every 2 minutes — silence the common case to keep
  # the journal readable. Errors from the dry-run go to stderr above.
  :
fi
```

- [ ] **Step 2: chmod +x**

```bash
chmod +x /home/nick/tc/twincars-manager/deploy/scripts/update.sh
```

- [ ] **Step 3: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/scripts/update.sh
git commit -m "deploy: add update.sh (poll registry, predeploy snapshot, auto-update)"
```

---

### Task 9: Author the systemd timer and service units

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/systemd/twincars-backup.service`
- Create: `/home/nick/tc/twincars-manager/deploy/systemd/twincars-backup.timer`
- Create: `/home/nick/tc/twincars-manager/deploy/systemd/twincars-update.service`
- Create: `/home/nick/tc/twincars-manager/deploy/systemd/twincars-update.timer`

- [ ] **Step 1: Write twincars-backup.service**

Write to `/home/nick/tc/twincars-manager/deploy/systemd/twincars-backup.service`:

```ini
[Unit]
Description=TwinCars daily PostgreSQL backup
Requires=postgres.service
After=postgres.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/twincars-backup-db.sh daily
# Don't run if a previous run is still going (rsync to storagebox could be slow)
RemainAfterExit=no
TimeoutStartSec=30min

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Write twincars-backup.timer**

Write to `/home/nick/tc/twincars-manager/deploy/systemd/twincars-backup.timer`:

```ini
[Unit]
Description=Daily PostgreSQL backup at 03:00 local time
Requires=twincars-backup.service

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
RandomizedDelaySec=10m
Unit=twincars-backup.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: Write twincars-update.service**

Write to `/home/nick/tc/twincars-manager/deploy/systemd/twincars-update.service`:

```ini
[Unit]
Description=TwinCars container registry poll + auto-update
After=network-online.target twincars-pod.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/twincars-update.sh
TimeoutStartSec=20min

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Write twincars-update.timer**

Write to `/home/nick/tc/twincars-manager/deploy/systemd/twincars-update.timer`:

```ini
[Unit]
Description=Poll registry every 2 minutes for new image manifests
Requires=twincars-update.service

[Timer]
OnBootSec=3min
OnUnitInactiveSec=2min
AccuracySec=30s
Unit=twincars-update.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 5: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/systemd/
git commit -m "deploy: add systemd timer units for daily backup + 2-min update poll"
```

---

### Task 10: Author the provision.sh bootstrap script

**Files:**

- Create: `/home/nick/tc/twincars-manager/deploy/scripts/provision.sh`

- [ ] **Step 1: Write the provisioning script**

Write to `/home/nick/tc/twincars-manager/deploy/scripts/provision.sh`:

```bash
#!/usr/bin/env bash
# Idempotent server bootstrap for tc.ts13.de.
#
# Run from the server: `bash /opt/twincars-deploy/scripts/provision.sh`
# Safe to re-run. Existing /etc/twincars/env/*.env files are NOT overwritten,
# preserving any secrets that were generated on a prior run.
#
# This script:
#  1. Installs system packages (podman, ufw, fail2ban, rsync, openssl, curl).
#  2. Configures ufw and fail2ban.
#  3. Creates /etc/twincars and /srv/twincars trees.
#  4. Generates (or reuses) Postgres password, APP_ENCRYPTION_KEY,
#     and the registry deploy-user password.
#  5. Renders Caddyfile with the bcrypt-hashed registry password.
#  6. Installs Quadlet units, systemd timers, /usr/local/bin scripts.
#  7. Sets up /root/.config/containers/auth.json so Quadlet units can pull
#     from the local registry (which is itself in the pod).
#  8. Reloads systemd, starts the pod.
#  9. Prints captured secrets exactly once.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "must run as root" >&2
  exit 1
fi

DEPLOY_DIR="${DEPLOY_DIR:-/opt/twincars-deploy}"
log() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

# ── 1. Packages ────────────────────────────────────────────────────────────
log "Install system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  podman uidmap slirp4netns fuse-overlayfs \
  ufw fail2ban rsync openssl ca-certificates curl wget jq

# Quadlet support is built into Podman 4.4+. Verify.
podman --version
if ! command -v /usr/lib/systemd/system-generators/podman-system-generator >/dev/null; then
  echo "podman-system-generator (Quadlet) not found — Podman package is too old" >&2
  exit 1
fi

# ── 2. Firewall ────────────────────────────────────────────────────────────
log "Configure ufw"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5000/tcp comment 'container registry'
ufw allow 5443/tcp comment 'manager admin'
ufw --force enable

log "Enable fail2ban for sshd"
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/sshd.local <<'JAIL'
[sshd]
enabled = true
mode = aggressive
maxretry = 5
findtime = 10m
bantime = 1h
JAIL
systemctl enable --now fail2ban

# ── 3. Filesystem layout ───────────────────────────────────────────────────
log "Create filesystem layout"
install -d -m 0700 /etc/twincars
install -d -m 0700 /etc/twincars/env
install -d -m 0755 /etc/twincars/caddy
install -d -m 0755 /srv/twincars/data/postgres
install -d -m 0755 /srv/twincars/data/registry
install -d -m 0755 /srv/twincars/data/caddy-data
install -d -m 0755 /srv/twincars/data/caddy-config
install -d -m 0755 /srv/twincars/backups/pg
install -d -m 0755 /etc/containers/systemd

# ── 4. Generate or reuse secrets ───────────────────────────────────────────
log "Generate or reuse secrets"
PG_ENV=/etc/twincars/env/postgres.env
MGR_ENV=/etc/twincars/env/manager.env
WEB_ENV=/etc/twincars/env/website.env
REG_ENV=/etc/twincars/env/registry.env
REG_PW_FILE=/etc/twincars/registry.deploy.pw

if [[ ! -f "$PG_ENV" ]]; then
  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  cat > "$PG_ENV" <<ENV
POSTGRES_USER=twincars
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=twincars
PGDATA=/var/lib/postgresql/data/pgdata
ENV
  chmod 600 "$PG_ENV"
  echo "  generated $PG_ENV"
else
  echo "  $PG_ENV already exists — keeping"
fi
POSTGRES_PASSWORD=$(grep -oP '(?<=POSTGRES_PASSWORD=).*' "$PG_ENV")

if [[ ! -f "$MGR_ENV" ]]; then
  APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
  cat > "$MGR_ENV" <<ENV
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
ORIGIN=https://tc.ts13.de:5443
DATABASE_URL=postgresql://twincars:${POSTGRES_PASSWORD}@127.0.0.1:5432/twincars
APP_ENCRYPTION_KEY=${APP_ENCRYPTION_KEY}
BODY_SIZE_LIMIT=67108864
ENV
  chmod 600 "$MGR_ENV"
  echo "  generated $MGR_ENV"
else
  echo "  $MGR_ENV already exists — keeping"
fi

if [[ ! -f "$WEB_ENV" ]]; then
  # The website's src/lib/server/config.ts validates TC_MANAGER_API_URL and
  # TC_MANAGER_API_TOKEN at module load — the container crashes on start if
  # they are missing. We generate a token now; the operator must paste it
  # into the manager's public API config when Phase 7 lands. Until then,
  # the website starts cleanly even though the public API isn't wired up.
  TC_MANAGER_API_TOKEN=$(openssl rand -hex 32)
  cat > "$WEB_ENV" <<ENV
NODE_ENV=production
HOST=0.0.0.0
PORT=3001
ORIGIN=https://tc.ts13.de
PUBLIC_SITE_URL=https://tc.ts13.de
TC_MANAGER_API_URL=http://localhost:3000
TC_MANAGER_API_TOKEN=${TC_MANAGER_API_TOKEN}
ENV
  chmod 600 "$WEB_ENV"
  echo "  generated $WEB_ENV"
else
  echo "  $WEB_ENV already exists — keeping"
fi

if [[ ! -f "$REG_ENV" ]]; then
  install -m 600 "${DEPLOY_DIR}/env-templates/registry.env" "$REG_ENV"
  echo "  installed $REG_ENV"
fi

if [[ ! -f "$REG_PW_FILE" ]]; then
  REG_PW=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
  echo "$REG_PW" > "$REG_PW_FILE"
  chmod 600 "$REG_PW_FILE"
  echo "  generated $REG_PW_FILE"
else
  echo "  $REG_PW_FILE already exists — keeping"
fi
REG_PW=$(cat "$REG_PW_FILE")

# ── 5. Render the Caddyfile with bcrypt-hashed registry password ──────────
log "Render Caddyfile"
# Pull caddy once if needed, then call hash-password with the plaintext.
podman pull docker.io/library/caddy:2-alpine >/dev/null
BCRYPT=$(podman run --rm docker.io/library/caddy:2-alpine \
  caddy hash-password --plaintext "$REG_PW")
# sed delimiter '#' avoids conflict with bcrypt's '/' and '$'
sed -e "s#{{BCRYPT_HASH}}#${BCRYPT}#g" \
  "${DEPLOY_DIR}/Caddyfile.tmpl" > /etc/twincars/caddy/Caddyfile
chmod 600 /etc/twincars/caddy/Caddyfile

# ── 6. Auth file for Podman pulls from the local registry ──────────────────
# Podman needs to know how to authenticate when pulling
# tc.ts13.de:5000/twincars-*. We store the creds in /root/.config/containers/auth.json
# (referenced by AuthFile= in the manager/website Quadlets).
log "Set up Podman registry credentials"
install -d -m 0700 /root/.config/containers
AUTH_B64=$(printf 'deploy:%s' "$REG_PW" | base64 -w0)
cat > /root/.config/containers/auth.json <<JSON
{
  "auths": {
    "tc.ts13.de:5000": {
      "auth": "${AUTH_B64}"
    }
  }
}
JSON
chmod 600 /root/.config/containers/auth.json

# ── 7. Quadlet units, scripts, systemd timers ──────────────────────────────
log "Install Quadlet units"
install -m 0644 "${DEPLOY_DIR}/quadlet/twincars.pod"          /etc/containers/systemd/
install -m 0644 "${DEPLOY_DIR}/quadlet/postgres.container"    /etc/containers/systemd/
install -m 0644 "${DEPLOY_DIR}/quadlet/manager.container"     /etc/containers/systemd/
install -m 0644 "${DEPLOY_DIR}/quadlet/website.container"     /etc/containers/systemd/
install -m 0644 "${DEPLOY_DIR}/quadlet/registry.container"    /etc/containers/systemd/
install -m 0644 "${DEPLOY_DIR}/quadlet/caddy.container"       /etc/containers/systemd/

log "Install scripts"
install -m 0755 "${DEPLOY_DIR}/scripts/backup-db.sh" /usr/local/bin/twincars-backup-db.sh
install -m 0755 "${DEPLOY_DIR}/scripts/update.sh"    /usr/local/bin/twincars-update.sh

log "Install systemd timer units"
install -m 0644 "${DEPLOY_DIR}/systemd/twincars-backup.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/twincars-backup.timer"   /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/twincars-update.service" /etc/systemd/system/
install -m 0644 "${DEPLOY_DIR}/systemd/twincars-update.timer"   /etc/systemd/system/

# ── 8. systemd reload + start ──────────────────────────────────────────────
log "Reload systemd, start the pod and timers"
systemctl daemon-reload

# The pod unit pulls in the container units transitively via [Install].
# Start the pod first, then the timers.
systemctl enable --now twincars-pod.service
systemctl enable --now twincars-backup.timer
systemctl enable --now twincars-update.timer

# manager + website containers will FAIL to start until the operator has
# pushed those images to the registry — that is expected on first bootstrap.
# Restart=always in their unit files keeps trying.

# ── 9. Wait briefly for Caddy to come up and provision a cert ─────────────
log "Wait for Caddy (up to 90s) so we can show endpoint status"
for i in $(seq 1 45); do
  if curl -fsS --max-time 3 http://127.0.0.1/ >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# ── 10. Print one-time secrets summary ─────────────────────────────────────
SECRETS_OUT=/etc/twincars/secrets.firstrun.txt
cat > "$SECRETS_OUT" <<SUMMARY
═══════════════════════════════════════════════════════════════════
 TwinCars deployment secrets — captured at $(date -Is)
 Keep these in your password manager. Stored on the server at:
   /etc/twincars/env/postgres.env   POSTGRES_PASSWORD
   /etc/twincars/env/manager.env    APP_ENCRYPTION_KEY
   /etc/twincars/registry.deploy.pw registry deploy password
═══════════════════════════════════════════════════════════════════

POSTGRES_PASSWORD     = $(grep -oP '(?<=POSTGRES_PASSWORD=).*' "$PG_ENV")
APP_ENCRYPTION_KEY    = $(grep -oP '(?<=APP_ENCRYPTION_KEY=).*' "$MGR_ENV")
TC_MANAGER_API_TOKEN  = $(grep -oP '(?<=TC_MANAGER_API_TOKEN=).*' "$WEB_ENV")
  (used by website→manager public API; mirror it into the manager when Phase 7 ships)

Container registry
  URL      : https://tc.ts13.de:5000
  Username : deploy
  Password : ${REG_PW}
  Login    : podman login tc.ts13.de:5000

═══════════════════════════════════════════════════════════════════

Next steps:
  1. On a developer machine, run:  podman login tc.ts13.de:5000
     (enter deploy / the password above)
  2. Build and push the website and manager images:
        cd twincars-website
        podman build -t tc.ts13.de:5000/twincars-website:latest .
        podman push tc.ts13.de:5000/twincars-website:latest

        cd ../twincars-manager
        podman build -t tc.ts13.de:5000/twincars-manager:latest .
        podman push tc.ts13.de:5000/twincars-manager:latest
  3. Within ~2 minutes, twincars-update.timer will pull and restart the
     manager + website containers. Or kick it manually with:
        systemctl start twincars-update.service
SUMMARY
chmod 600 "$SECRETS_OUT"

cat "$SECRETS_OUT"

log "Provisioning complete. Pod state:"
podman pod ps
podman ps --all
```

- [ ] **Step 2: chmod +x**

```bash
chmod +x /home/nick/tc/twincars-manager/deploy/scripts/provision.sh
```

- [ ] **Step 3: Commit**

```bash
cd /home/nick/tc/twincars-manager
git add deploy/scripts/provision.sh
git commit -m "deploy: add idempotent provision.sh for one-shot server bootstrap"
```

---

## Phase 3: Provision the server

### Task 11: Pre-create secure directory on server + upload storagebox key

**Files (server):**

- Create: `/etc/twincars/` (mode 0700)
- Create: `/etc/twincars/storagebox.key` (mode 0600)

- [ ] **Step 1: Pre-create /etc/twincars with mode 0700 on the server**

Run from the dev machine:

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
ssh -i $KEY $SERVER 'install -d -m 0700 /etc/twincars'
```

Expected: no output, exit 0.

- [ ] **Step 2: Upload the Storagebox SSH key**

```bash
scp -i $KEY /home/nick/tc/twincars-manager/ssh/twincars-manager $SERVER:/etc/twincars/storagebox.key
ssh -i $KEY $SERVER 'chmod 600 /etc/twincars/storagebox.key && ls -la /etc/twincars/storagebox.key'
```

Expected: `-rw------- 1 root root … /etc/twincars/storagebox.key`.

- [ ] **Step 3: Verify storagebox connectivity from the server**

```bash
ssh -i $KEY $SERVER 'ssh -i /etc/twincars/storagebox.key -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes u589158@u589158.your-storagebox.de "echo storagebox ok && ls /"'
```

Expected: prints `storagebox ok` and some directory listing. If this fails, do not continue — backups would silently break.

---

### Task 12: Rsync the deploy directory to the server

- [ ] **Step 1: Rsync the deploy/ tree to /opt/twincars-deploy/**

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
cd /home/nick/tc/twincars-manager
rsync -e "ssh -i $KEY" -av --delete deploy/ $SERVER:/opt/twincars-deploy/
```

Expected: lists all files transferred. No errors.

- [ ] **Step 2: Verify the layout on the server**

```bash
ssh -i $KEY $SERVER 'find /opt/twincars-deploy -maxdepth 2 -type f | sort'
```

Expected output (order may vary):

```
/opt/twincars-deploy/Caddyfile.tmpl
/opt/twincars-deploy/README.md
/opt/twincars-deploy/env-templates/registry.env
/opt/twincars-deploy/quadlet/caddy.container
/opt/twincars-deploy/quadlet/manager.container
/opt/twincars-deploy/quadlet/postgres.container
/opt/twincars-deploy/quadlet/registry.container
/opt/twincars-deploy/quadlet/twincars.pod
/opt/twincars-deploy/quadlet/website.container
/opt/twincars-deploy/scripts/backup-db.sh
/opt/twincars-deploy/scripts/provision.sh
/opt/twincars-deploy/scripts/update.sh
/opt/twincars-deploy/systemd/twincars-backup.service
/opt/twincars-deploy/systemd/twincars-backup.timer
/opt/twincars-deploy/systemd/twincars-update.service
/opt/twincars-deploy/systemd/twincars-update.timer
```

- [ ] **Step 3: Verify scripts are executable**

```bash
ssh -i $KEY $SERVER 'ls -l /opt/twincars-deploy/scripts/'
```

Expected: all `*.sh` files have `-rwxr-xr-x` perms. If not, fix:

```bash
ssh -i $KEY $SERVER 'chmod +x /opt/twincars-deploy/scripts/*.sh'
```

---

### Task 13: Run provision.sh and capture secrets

- [ ] **Step 1: Execute provision.sh**

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
ssh -i $KEY -t $SERVER 'bash /opt/twincars-deploy/scripts/provision.sh' 2>&1 | tee /tmp/twincars-provision.log
```

Expected: the log ends with a "TwinCars deployment secrets" block and `pod state:` showing the `twincars` pod up. Manager + website containers show as "exited" / "restarting" — this is expected (image not in registry yet).

- [ ] **Step 2: Capture secrets to your password manager**

Open `/tmp/twincars-provision.log`. Save these three values into your password manager under "TwinCars production":

- `POSTGRES_PASSWORD`
- `APP_ENCRYPTION_KEY`
- Registry deploy password

**Then delete the local log:**

```bash
shred -u /tmp/twincars-provision.log
```

- [ ] **Step 3: Verify firewall**

```bash
ssh -i $KEY $SERVER 'ufw status verbose'
```

Expected: ufw active, only 22, 80, 443, 5000, 5443 ALLOW IN.

- [ ] **Step 4: Verify fail2ban**

```bash
ssh -i $KEY $SERVER 'fail2ban-client status sshd'
```

Expected: status with jail loaded and "Currently banned: 0".

---

### Task 14: Verify pod is healthy (infrastructure containers up)

- [ ] **Step 1: Check pod and container states**

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
ssh -i $KEY $SERVER 'podman pod ps && echo --- && podman ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
```

Expected:

- pod `twincars` Running
- `postgres` Up (healthy)
- `registry` Up (healthy)
- `caddy` Up (health may be "starting" for the first 60s while it provisions the cert)
- `manager` and `website` either "Created" (no image yet) or "Restarting" — **this is OK**.

- [ ] **Step 2: Tail Caddy logs to verify cert issuance**

```bash
ssh -i $KEY $SERVER 'journalctl -u caddy.service -n 100 --no-pager'
```

Expected: log lines containing `obtain certificate` and `certificate obtained successfully` for `tc.ts13.de`. If Caddy is still working (you see "trying" or "challenge"), wait 30s and re-run.

- [ ] **Step 3: HTTPS smoke from the dev machine**

```bash
curl -fsSI https://tc.ts13.de/ | head -5
```

Expected: `HTTP/2 502` is acceptable at this stage (website container not running yet) **AS LONG AS** you see a valid TLS connection (no "SSL certificate problem"). To verify TLS independently:

```bash
echo | openssl s_client -connect tc.ts13.de:443 -servername tc.ts13.de 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

Expected: subject `CN = tc.ts13.de`, issuer `Let's Encrypt`, validity dates.

---

## Phase 4: First deploy — push images, watch auto-update

### Task 15: Login to the registry from the dev machine

- [ ] **Step 1: Run podman login**

```bash
podman login tc.ts13.de:5000
# Username: deploy
# Password: (from the captured secrets)
```

Expected: `Login Succeeded!`. Credentials persist in `~/.config/containers/auth.json` (or `~/.docker/config.json` for Docker).

- [ ] **Step 2: Verify with anonymous curl (should be 401)**

```bash
curl -fsSI https://tc.ts13.de:5000/v2/
```

Expected: HTTP 401 — basic auth is working.

```bash
curl -fsSI -u deploy:<password> https://tc.ts13.de:5000/v2/
```

Expected: HTTP 200.

---

### Task 16: Build and push the website image

- [ ] **Step 1: Build**

```bash
cd /home/nick/tc/twincars-website
podman build -t tc.ts13.de:5000/twincars-website:latest .
```

Expected: build completes without errors. Final line: `Successfully tagged tc.ts13.de:5000/twincars-website:latest`.

- [ ] **Step 2: Push**

```bash
podman push tc.ts13.de:5000/twincars-website:latest
```

Expected: layers upload, ends with `Writing manifest …`.

---

### Task 17: Build and push the manager image

- [ ] **Step 1: Build**

```bash
cd /home/nick/tc/twincars-manager
podman build -t tc.ts13.de:5000/twincars-manager:latest .
```

Expected: build completes. The build will take longer than the website (more deps).

- [ ] **Step 2: Push**

```bash
podman push tc.ts13.de:5000/twincars-manager:latest
```

Expected: layers upload.

---

### Task 18: Kick the update timer and verify both apps come up

- [ ] **Step 1: Force-trigger the update**

Instead of waiting for the 2-min timer:

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
ssh -i $KEY $SERVER 'systemctl start twincars-update.service && journalctl -u twincars-update.service -n 50 --no-pager'
```

Expected: log includes `manifest difference detected` → `taking pre-deploy DB snapshot` → `running podman auto-update` → output listing manager + website restarted.

Actually, on this very first push the existing containers were in `Restarting` state with no prior image, so `podman auto-update` may not classify them as "Updated=true". If the log shows "no updates" but the manager+website containers are still not running, restart them explicitly:

```bash
ssh -i $KEY $SERVER 'systemctl restart manager.service website.service && sleep 5 && podman ps'
```

- [ ] **Step 2: Verify both containers are up (healthy or starting)**

```bash
ssh -i $KEY $SERVER 'podman ps --format "table {{.Names}}\t{{.Status}}"'
```

Expected: 5 rows, all "Up". For manager + website, `(starting)` health is acceptable for the first 60s; then it should become `(healthy)`.

- [ ] **Step 3: Tail logs for any startup errors**

```bash
ssh -i $KEY $SERVER 'journalctl -u manager.service -n 100 --no-pager'
ssh -i $KEY $SERVER 'journalctl -u website.service -n 50 --no-pager'
```

Manager log should show `Migrations run.` (or no migrations needed) followed by `Listening on http://0.0.0.0:3000`. Website log should show `Listening on http://0.0.0.0:3001`.

---

## Phase 5: Validation

### Task 19: HTTPS + TLS smoke tests from the dev machine

- [ ] **Step 1: Website root**

```bash
curl -fsSI https://tc.ts13.de/ | head -10
```

Expected:

```
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
permissions-policy: geolocation=(), microphone=(), camera=()
content-type: text/html; charset=UTF-8
```

- [ ] **Step 2: Manager (port 5443)**

```bash
curl -fsSI https://tc.ts13.de:5443/ | head -10
```

Expected: `HTTP/2 200` (or `302` to `/login`) with the same security headers.

- [ ] **Step 3: Registry requires auth (401 anon, 200 with creds)**

```bash
curl -fsSI https://tc.ts13.de:5000/v2/
```

Expected: `HTTP/2 401`.

```bash
curl -fsSI -u deploy:<password> https://tc.ts13.de:5000/v2/
```

Expected: `HTTP/2 200`.

- [ ] **Step 4: Cert sanity on all three ports**

```bash
for p in 443 5443 5000; do
  echo "=== port $p ==="
  echo | openssl s_client -connect tc.ts13.de:$p -servername tc.ts13.de 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates
done
```

Expected: all three ports return the same `CN = tc.ts13.de`, issued by Let's Encrypt, with validity dates ~90 days in the future.

- [ ] **Step 5: HTTP→HTTPS redirect**

```bash
curl -fsSI http://tc.ts13.de/ | head -3
```

Expected: `HTTP/1.1 308` with `Location: https://tc.ts13.de/`.

---

### Task 20: Trigger a manual backup and verify it lands on the Storagebox

- [ ] **Step 1: Run a daily backup**

```bash
KEY=/home/nick/tc/twincars-manager/ssh/twincars-manager
SERVER=root@tc.ts13.de
ssh -i $KEY $SERVER '/usr/local/bin/twincars-backup-db.sh daily'
```

Expected: log lines including `dumping into …`, `uploading to u589158@…`, `done`.

- [ ] **Step 2: Verify file lands on the Storagebox**

```bash
ssh -i $KEY $SERVER 'ssh -i /etc/twincars/storagebox.key -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes u589158@u589158.your-storagebox.de "ls -la /home/backups/postgres/"'
```

Expected: a `YYYY-MM-DDT…Z.sql.gz` file with non-zero size.

- [ ] **Step 3: Verify local copy**

```bash
ssh -i $KEY $SERVER 'ls -la /srv/twincars/backups/pg/'
```

Expected: same file present locally.

---

### Task 21: Smoke the auto-update flow with a no-op rebuild

- [ ] **Step 1: Rebuild the website without source changes (different layer SHAs)**

```bash
cd /home/nick/tc/twincars-website
podman build --no-cache -t tc.ts13.de:5000/twincars-website:latest .
podman push tc.ts13.de:5000/twincars-website:latest
```

Expected: a fresh manifest digest is pushed.

- [ ] **Step 2: Wait for the update timer (or trigger manually)**

```bash
ssh -i $KEY $SERVER 'systemctl start twincars-update.service'
```

- [ ] **Step 3: Verify the website container restarted with the new digest**

```bash
ssh -i $KEY $SERVER 'podman ps --format "{{.Names}}\t{{.CreatedHuman}}" | grep website'
```

Expected: `website  <few seconds>` (recent restart).

- [ ] **Step 4: Verify a pre-deploy backup was taken**

```bash
ssh -i $KEY $SERVER 'ls -la /srv/twincars/backups/pg/ | grep predeploy'
```

Expected: at least one `*_predeploy.sql.gz` file with recent timestamp.

---

### Task 22: Playwright validation of website + manager

This task uses Playwright MCP via the agent (not a project dependency).

- [ ] **Step 1: Browse the website root**

Use Playwright MCP to navigate to `https://tc.ts13.de/`.

Verify:

- Page loads (no 4xx/5xx).
- The expected hero/landing content from `src/routes/+page.svelte` renders.
- Browser console has no errors.
- Padlock indicates a valid TLS connection.

- [ ] **Step 2: Browse the manager**

Navigate to `https://tc.ts13.de:5443/`.

Verify:

- Either the **setup wizard** (`/setup`) or the **login form** appears (depending on whether the manager has been set up).
- All asset URLs (CSS, JS, fonts) return 200.
- No console errors.
- Padlock valid.

- [ ] **Step 3: Verify auth endpoint**

Navigate to `https://tc.ts13.de:5443/api/auth/get-session`.

Verify: returns JSON `{"session":null,"user":null}` (or a session if you're logged in) — proves better-auth is reachable.

- [ ] **Step 4: Take screenshots for the runbook**

Capture screenshots of the website and the manager landing — these can be referenced from `deploy/README.md` if desired.

---

### Task 23: Commit any final adjustments and tag the deployment

- [ ] **Step 1: Verify nothing in the local working tree was changed by the smoke runs**

```bash
cd /home/nick/tc/twincars-manager
git status
```

Expected: no new modifications beyond the staged deploy/ commits.

```bash
cd /home/nick/tc/twincars-website
git status
```

Expected: clean except for the committed Dockerfile + .dockerignore.

- [ ] **Step 2: Push the manager repo**

```bash
cd /home/nick/tc/twincars-manager
git push origin main
```

- [ ] **Step 3: Push the website repo (skipped — local-only repo)**

The website was initialized as a local-only git repo in Task 1 (no remote configured). Skip pushing. Confirm the local tree is clean:

```bash
cd /home/nick/tc/twincars-website
git status
git log --oneline -5
```

If a remote is configured later (e.g., GitHub/Gitea), push then.

- [ ] **Step 4: Document the deployment in the manager repo CHANGELOG (if one exists)**

If `CHANGELOG.md` or similar exists in the manager repo, add an entry. If not, skip — the commit history is sufficient.

---

## Self-review notes (already addressed)

- Spec coverage: every spec section maps to a task — Caddyfile (Task 4), Quadlets (Task 5), env (Tasks 6, 10), backups (Tasks 7, 9, 20), auto-update (Tasks 8, 9, 21), provisioning (Task 10), routing validation (Task 19), Playwright (Task 22).
- No placeholders — `{{BCRYPT_HASH}}` is the literal sentinel that `provision.sh` substitutes.
- Manager + website containers will be in a Restarting state until Task 18 — explicitly called out.
- The Storagebox key is uploaded out-of-band (Task 11) so it is never in `/opt/twincars-deploy/`.
- Idempotent provisioning: provision.sh checks for existing env files and reuses secrets.
