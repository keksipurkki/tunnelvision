###################################################################
#
# Provision a Tunnelvision production instance
# @see https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html#user-data-shell-scripts
# @see https://hub.docker.com/_/amazonlinux
#
###################################################################

set -e

# Close stdin and save output
exec 0<&- &> provision.log

finish() {
  log_group=/tunnelvision/provision
  log_stream=$(date +%Y%m%d)
  timestamp=$(( 1000 * $(date +%s) ))
  message="$(cat provision.log)"
  aws logs put-log-events \
    --log-group-name $log_group \
    --log-stream-name $log_stream \
    --log-events "timestamp=$timestamp,message=$message"
}

trap finish EXIT

echo "It works!"

#clean_state() {
#  rm -rf tunnelvision.zip tunnelvision-*
#  yum -y update
#}
#
## Free up port 22 and prevent monkey-business via SSH
#disable_ssh() {
#  chkconfig sshd off || true
#  service sshd stop || true
#  yum -y erase openssh-server
#}
#
#latest_release() {
#  local url=$1
#  curl -s "$url" | grep "browser_download_url.*zip" | cut -d '"' -f 4
#}
#
#launch() {
#
#  pushd $1
#
#  cat > .env <<EOF
## AWS
#AWS_ACCOUNT="011252223791"
#AWS_REGION=eu-north-1
#
## Misc
#FORCE_COLOR=1
#NODE_ENV=production
#
## App
#MAX_CONNECTIONS=50
#
## Certbot
#APP_HOSTNAME=tunnelvision.me
#STACK_NAME=tunnelvision-me
#EMAIL=admin@tunnelvision.me
#
#EOF
#
#  docker swarm init
#  docker stack deploy tunnelvision -c production.yml
#
#  popd
#
#}
#
## Start
#
#clean_state
#which sshd && disable_ssh
#
#cat << EOF
#===================================================================
#
#Downloading the latest release
#
#===================================================================
#EOF
#
#
#release=$(latest_release https://api.github.com/repos/keksipurkki/tunnelvision/releases/latest)
#curl -L $release -o tunnelvision.zip
#unzip -q tunnelvision.zip
#
#release=$(echo tunnelvision-*)
#
#if [[ -z "$release" ]]; then
#  echo "Failed to download the release" >&2
#  exit 1
#fi
#
#IFS=- read app version <<< "$release"
#
#cat << EOF
#===================================================================
#
#  Launching $app (revision: $version)
#
#===================================================================
#EOF
#
#launch $release

# vim: set ft=bash :
