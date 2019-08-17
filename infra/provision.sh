#!/bin/bash

###################################################################
#
# Provision a Tunnelvision production instance
# @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-shell-scripts
# @see https://hub.docker.com/_/amazonlinux
#
###################################################################

# Close stdin
exec 0<&-

# Update runtime
yum -y update

# Free up port 22 and prevent monkey-business via SSH
chkconfig sshd off
service sshd stop
yum -y erase openssh-server

# Mount previous Docker volumes if any
#mount

# Profit
curl -s https://api.github.com/repos/keksipurkki/tunnelvision/releases/latest \
| grep "browser_download_url.*zip" \
| cut -d '"' -f 4 \
| wget -qi -

unzip tunnelvision.zip

cat > .env <<EOF
# AWS
AWS_PROFILE=default
AWS_ACCOUNT="011252223791"
AWS_REGION=eu-north-1

# Misc
FORCE_COLOR=1
NODE_ENV=production

# App
MAX_CONNECTIONS=50

# Certbot
APP_HOSTNAME=tunnelvision.me
STACK_NAME=tunnelvision-me
EMAIL=admin@tunnelvision.me

EOF
source .env
docker stack deploy $STACK_NAME -c production.yml
