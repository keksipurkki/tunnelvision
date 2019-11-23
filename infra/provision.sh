###################################################################
#
# Provision a Tunnelvision production instance
# @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-shell-scripts
# @see https://hub.docker.com/_/amazonlinux
#
###################################################################

set -e
set -a

cat > .env << EOF

AWS_ACCOUNT="011252223791"
AWS_DEFAULT_REGION=eu-north-1

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

cat << EOF
===================================================================


Provisioning Tunnelvision

$(date)
$(env)

===================================================================
EOF

curl -sOL "https://github.com/keksipurkki/tunnelvision/releases/latest/download/tunnelvision.sh"
pwd
ls -a
sh tunnelvision.sh run

# vim: set ft=sh :
