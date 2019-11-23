#!/bin/sh

set -o errexit
set -o nounset

: ${EMAIL:?"Email is required"}
: ${APP_HOSTNAME:?"App hostname is required"}

pip install --upgrade pip
pip install "awscli<1.15" "botocore==1.12.89"
aws s3 sync s3://tunnelvision-me-letsencrypt /etc/letsencrypt

if [[ -r /etc/letsencrypt/live/tunnelvision.me ]]; then
  certbot renew
else
  certbot certonly    \
    --dns-route53     \
    --agree-tos       \
    --email $EMAIL    \
    --cert-name tunnelvision.me \
    -n                \
    -d $APP_HOSTNAME  \
    -d '*.'$APP_HOSTNAME
fi

while true; do
  aws s3 sync --follow-symlinks /etc/letsencrypt s3://tunnelvision-me-letsencrypt
  sleep 86400
  echo Requesting certificates for $APP_HOSTNAME
  certbot renew
done
