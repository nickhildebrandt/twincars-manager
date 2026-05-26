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

set -euo pipefail

mode="${1:-daily}"
ts=$(date -u +%Y-%m-%dT%H-%M-%SZ)
local_dir=/srv/twincars/backups/pg
SSHK=/etc/twincars/storagebox.key
SSHU="u589158@u589158.your-storagebox.de"
SSHO="-o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o IdentitiesOnly=yes"

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
  ssh -i "$SSHK" $SSHO "$SSHU" "mkdir -p ${remote_dir}" || true
  rsync -e "ssh -i $SSHK $SSHO" "$out" "${SSHU}:${remote_dir}/"
  echo "[$(date -Is)] backup-db: remote retention (keep ${remote_keep_days}d)"
  ssh -i "$SSHK" $SSHO "$SSHU" \
    "find ${remote_dir} -maxdepth 1 -name '*${suffix}.sql.gz' -mtime +${remote_keep_days} -delete" || true
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
