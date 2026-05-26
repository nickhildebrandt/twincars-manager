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
  podman catatonit uidmap slirp4netns fuse-overlayfs \
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
# Containers (Podman bridge) need to forward traffic out to the internet.
# Default UFW forward policy is DROP which silently breaks container DNS/HTTPS.
ufw default allow routed
sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5000/tcp comment 'container registry'
ufw allow 5443/tcp comment 'manager admin'
ufw --force enable
ufw reload

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
BETTER_AUTH_URL=https://tc.ts13.de:5443
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

# Quadlet-generated units (twincars-pod.service, *.container) are transient
# and cannot be `systemctl enable`d directly — `[Install] WantedBy=` inside
# the .pod/.container file is honored by the generator on every daemon-reload,
# so they auto-start at boot. For the first boot, just `start` them.
systemctl start twincars-pod.service
# The systemd .timer files ARE static units, so they can be enabled normally.
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
