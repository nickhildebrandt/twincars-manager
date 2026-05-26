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
