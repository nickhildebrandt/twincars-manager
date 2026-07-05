---
title: Operations - deployment (tc.ts13.de)
tags: [operations, deployment, podman, caddy]
updated: 2026-07-05
---

# Deployment - Hetzner Podman pod on tc.ts13.de

Operator runbook: `deploy/README.md` (authoritative commands). Design
history: `archive/specs/2026-05-26-hetzner-podman-deployment-design.md`
and `archive/plans/2026-05-26-hetzner-podman-deployment.md`.

## Topology

Single Debian 13 KVM, **Podman only** (no Docker), one pod `twincars`
with five containers, lifecycle via systemd **Quadlet** units in
`/etc/containers/systemd/` (repo copies in `deploy/quadlet/`). Only
Caddy publishes host ports; inter-container traffic uses the pod
loopback.

| URL                                            | Backend (pod-internal)                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `https://tc.ts13.de/`                          | website container :3001                                                    |
| `https://tc.ts13.de:5443/`                     | manager container :3000 (this app)                                         |
| `https://tc.ts13.de:5000/v2`                   | registry :5001 (Caddy basic_auth user `deploy`)                            |
| `https://tc.ts13.de/api/ebay/account-deletion` | routed to the MANAGER on the 443 vhost (eBay requires port 443 - [[ebay]]) |

Containers: `postgres` (postgres:18-alpine, data
`/srv/twincars/data/postgres`), `manager`
(`tc.ts13.de:5000/twincars-manager:latest`,
`io.containers.autoupdate=registry`, healthcheck
`scripts/healthcheck.cjs`), `website`, `registry` (registry:2 on :5001),
`caddy` (caddy:2-alpine; TLS 1.3, HSTS preload, HTTP/3; Caddyfile from
`deploy/Caddyfile.tmpl` with the bcrypt registry hash inlined).

## Update flow (push-to-deploy)

1. Build + push from a dev machine:
   `podman build -t tc.ts13.de:5000/twincars-manager:latest . && podman push ...`
   (login once with the `deploy` credentials).
2. `twincars-update.timer` (every 2 min) runs `update.sh`:
   `podman auto-update --dry-run`; on change → predeploy `pg_dump`
   snapshot → `podman auto-update` restarts changed containers.
3. Manager container CMD = `node scripts/migrate.js && node build` -
   migrations run before serving; failure halts the container (never a
   half-migrated DB).
4. Force immediately: `systemctl start twincars-update.service`.
5. Rollback: retag a previous digest to `:latest` +
   `systemctl restart manager.service`, restore DB if migrations were
   destructive ([[backup-and-restore]]).

Postgres/registry/caddy stay on pinned tags (no autoupdate label).

## Provisioning

`deploy/scripts/provision.sh` (idempotent one-shot): creates
`/etc/twincars/env/*.env` (mode 600), generates `POSTGRES_PASSWORD`,
`APP_ENCRYPTION_KEY` and the registry password (printed once, kept in
`secrets.firstrun.txt`), installs quadlets, timers, ufw (22/80/443/
5000/5443 only), fail2ban, catatonit. First-time bootstrap steps in
`deploy/README.md` (rsync `deploy/` to `/opt/twincars-deploy/`, upload
the Storagebox key `ssh/twincars-manager` →
`/etc/twincars/storagebox.key`).

## Ops commands

- Status: `systemctl list-units 'twincars-*' postgres.service manager.service website.service caddy.service registry.service`
- Logs: `journalctl -u manager.service -e -n 200`
- Manual backup: `/usr/local/bin/twincars-backup-db.sh daily`

Env vars per container: [[environment-variables]]. Image build quirks
(prune --ignore-scripts, BODY_SIZE_LIMIT, mdbtools, otel shim):
[[known-constraints]].
