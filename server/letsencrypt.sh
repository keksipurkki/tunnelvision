#!/bin/sh

set -o errexit
set -o nounset

: ${EMAIL:?"Email is required"}
: ${APP_HOSTNAME:?"App hostname is required"}

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
done
