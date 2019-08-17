###################################################################
#
# Provision a Tunnelvision production instance
# @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-shell-scripts
# @see https://hub.docker.com/_/amazonlinux
#
###################################################################

# Close stdin
exec 0<&-

set -e

rm -rf tunnelvision.zip tunnelvision-*

# Update runtime
yum -y update

yes | amazon-linux-extras install docker
service docker start

# Free up port 22 and prevent monkey-business via SSH
if which sshd; then
  chkconfig sshd off || true
  service sshd stop || true
  yum -y erase openssh-server
fi

# Mount previous Docker volumes if any

# Profit
curl -s https://api.github.com/repos/keksipurkki/tunnelvision/releases/latest \
| grep "browser_download_url.*zip" \
| cut -d '"' -f 4 > latest.url

curl -Lo tunnelvision.zip $(< latest.url)
unzip tunnelvision.zip
cd tunnelvision-*/

cat > .env <<EOF
# AWS
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
docker swarm init
docker stack deploy $STACK_NAME -c production.yml
