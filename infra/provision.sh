###################################################################
#
# Provision a Tunnelvision production instance
# @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-shell-scripts
# @see https://hub.docker.com/_/amazonlinux
#
###################################################################

set -e

# Save output to system logs (EC2 Instances -> Actions -> Instance Settings -> System log)
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

cat << EOF
===================================================================


Provisioning Tunnelvision

$(date)
$(env)

===================================================================
EOF

suicide() {
  echo "Requesting the instance to terminate"
}

latest_release() {
  local url=$1
  curl -s "$url" | grep "browser_download_url.*zip" | cut -d '"' -f 4
}

launch() {

  pushd $1

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

  docker swarm init
  docker stack deploy tunnelvision -c production.yml

  popd

}

# Start

if [[ -d tunnelvision-* ]]; then
  echo "Image not in clean state. Aborting!" >&2
  exit 1
fi

{

  yum -y update
  yum -y install unzip
  sudo amazon-linux-extras install -y ecs; sudo systemctl enable --now ecs

  chkconfig sshd off
  service sshd stop
  yum -y erase openssh-server

} > /dev/null

cat << EOF
===================================================================

Downloading the latest release

===================================================================
EOF

download_url=$(latest_release https://api.github.com/repos/keksipurkki/tunnelvision/releases/latest)
curl -sL "$download_url" -o tunnelvision.zip
unzip -q tunnelvision.zip

release=$(echo tunnelvision-*)

if [[ -d "$release" ]]; then
  echo Found $release
else
  echo "Failed to download the release" >&2
  ls -R
  exit 1
fi

IFS=- read app version <<< "$release"

cat << EOF
===================================================================

  Launching $app (revision: $version)

===================================================================
EOF

launch $release

# TODO: Suicide or DNS connect

# vim: set ft=bash :
