#!/usr/bin/env bash
set -euo pipefail

USERNAME="${SUDO_USER:-$USER}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

SSH_HOST="u589158@u589158.your-storagebox.de"
SSH_KEY="$SCRIPT_DIR/twincars-manager"
MOUNT_POINT="/media/$USERNAME/twincars-manager-backup"

if ! command -v sshfs >/dev/null 2>&1; then
  echo "Error: sshfs is not installed." >&2
  exit 1
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Error: SSH key not found at $SSH_KEY" >&2
  exit 1
fi

sudo mkdir -p "$MOUNT_POINT"
sudo chown "$USERNAME:$USERNAME" "$MOUNT_POINT"

sshfs "$SSH_HOST:/" "$MOUNT_POINT" \
  -o IdentityFile="$SSH_KEY" \
  -o IdentitiesOnly=yes \
  -o reconnect \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
  -o uid="$(id -u "$USERNAME")" \
  -o gid="$(id -g "$USERNAME")"

echo "Mounted $SSH_HOST:/ to $MOUNT_POINT"