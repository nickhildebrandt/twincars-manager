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
