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
    # Only consider files matching our suffix pattern.
    if [[ "$mode" == "daily" ]]; then
      # Daily mode: bare *.sql.gz, never touch *_predeploy.sql.gz.
      [[ "$f" == *_predeploy.sql.gz ]] && continue
      [[ "$f" != *.sql.gz ]] && continue
      name_ts="${f%.sql.gz}"
    else
      [[ "$f" != *_predeploy.sql.gz ]] && continue
      name_ts="${f%_predeploy.sql.gz}"
    fi
    # Lexicographic compare works because ts is fixed-width ISO 8601 UTC.
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
