#!/bin/sh

set -o errexit
set -o nounset

: ${EMAIL:?"Email is required"}
: ${APP_HOSTNAME:?"App hostname is required"}

pip install --upgrade pip
pip install awscli
aws s3 sync s3://tunnelvision-me-letsencrypt /etc/letsencrypt 

certbot certonly                  \
                --dns-route53     \
                --agree-tos       \
                --email $EMAIL    \
                -n                \
                -d $APP_HOSTNAME  \
                -d '*.'$APP_HOSTNAME

while true; do
  sleep 86400
  echo Requesting certificates for $APP_HOSTNAME
  certbot renew
  aws s3 sync --follow-symlinks /etc/letsencrypt s3://tunnelvision-me-letsencrypt 
done
