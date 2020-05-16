#!/bin/sh

set -o errexit
set -o nounset

trap 'post_mortem' EXIT INT HUP TERM KILL

: ${EMAIL:?"Email is required"}
: ${APP_HOSTNAME:?"App hostname is required"}

function log() {
  cat >&2 << EOF
=================================================================================
  $@
=================================================================================
EOF
}

function post_mortem() {
  log "Post mortem"
  cat /var/log/letsencrypt/letsencrypt.log
}

function most_recent() {
  local pattern=$1
  archive=/etc/letsencrypt/archive/${APP_HOSTNAME}/
  find $archive | grep -E $pattern | tail -n1
}

function initial_state() {
  live=/etc/letsencrypt/live/${APP_HOSTNAME}
  rm -rf /etc/letsencrypt/*

  # This should be enough
  log "Syncing container state with S3"
  aws s3 sync s3://tunnelvision-me-letsencrypt /etc/letsencrypt

  # Workaround: certbot.errors.CertStorageError: expected /etc/letsencrypt/live/*/cert.pem to be a symlink
  log "Symlinking certificates"
  rm -rf $live
  mkdir -p /etc/letsencrypt/live/${APP_HOSTNAME}
  ln -s $(most_recent "/fullchain[0-9]+.pem") $live/fullchain.pem
  ln -s $(most_recent "/cert[0-9]+.pem") $live/cert.pem 
  ln -s $(most_recent "/chain[0-9]+.pem") $live/chain.pem
  ln -s $(most_recent "/privkey[0-9]+.pem") $live/privkey.pem
  ls -Rl $live
}

initial_state

if [[ -r /etc/letsencrypt/live/tunnelvision.me ]]; then
  log "Attempting to renew certificates"
  certbot renew
else
  log "Requesting initial certificates"
  certbot certonly    \
    --dns-route53     \
    --agree-tos       \
    --email $EMAIL    \
    --cert-name $APP_HOSTNAME \
    -n                \
    -d $APP_HOSTNAME  \
    -d '*.'$APP_HOSTNAME
fi

log "Entering run loop"
while true; do
  aws s3 sync --no-follow-symlinks /etc/letsencrypt s3://tunnelvision-me-letsencrypt
  sleep 86400
  log "Daily renewal request for certificates of $APP_HOSTNAME"
  certbot renew
done
