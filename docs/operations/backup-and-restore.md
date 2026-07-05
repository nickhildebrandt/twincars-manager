---
title: Operations - backup and restore
tags: [operations, backup, postgres]
updated: 2026-07-05
---

# Backup and restore

Backups are an **operations concern**, never the application's: the app
container runs no pg_dump, the migration runner takes no snapshots
(CONTRIBUTING §17). Script: `deploy/scripts/backup-db.sh` (installed as
`/usr/local/bin/twincars-backup-db.sh`), adapted to the Hetzner
Storagebox restricted shell.

## Daily

`twincars-backup.timer` at 03:00:
`podman exec postgres pg_dump -U twincars twincars | gzip` →
`/srv/twincars/backups/pg/<UTC timestamp>.sql.gz`, then rsync over SSH
(key `/etc/twincars/storagebox.key`) to
`u589158@u589158.your-storagebox.de:/home/backups/postgres/`.
Retention: local 3 days, Storagebox 14 days.

## Pre-deploy

`update.sh` calls the same script in predeploy mode before any
auto-update that changes images: filename suffixed
`_predeploy_<digest>`, uploaded to `/home/backups/postgres-predeploy/`,
local retention 7 days. Take an explicit snapshot before deploying
migrations that drop/alter existing structure.

## Restore

```sh
# clean slate (optional)
podman exec -i postgres psql -U twincars -d postgres \
  -c "DROP DATABASE twincars; CREATE DATABASE twincars;"
gunzip -c <backup.sql.gz> | podman exec -i postgres psql -U twincars -d twincars
```

From a dev machine: pipe through
`ssh -i ssh/twincars-manager root@tc.ts13.de 'podman exec -i postgres psql ...'`.
After a restore the manager reapplies any newer migrations on its next
start ([[deployment]]).

Related: [[fresh-db-reset]].
