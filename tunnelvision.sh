#!/bin/bash

set -e

die()
{
  echo $1 >&2
  exit 1
}

urlencode()
{
  python -c "import urllib, sys; print urllib.quote(sys.stdin.read(), '\n\/')"
}

parse()
{
  python -c "import json,sys;print(json.load(sys.stdin)[\"$1\"])" 2> /dev/null
}

pretty()
{
  python -mjson.tool
}

prune()
{

  local credentials=$1
  local github_repository=keksipurkki/tunnelvision
  local repo_url=https://api.github.com/repos/$github_repository

  if [[ -z "$credentials" ]]; then
    die "No Github credentials given. Aborting"
  fi

  res=$(curl -s --header 'Accept: application/json' --user "$credentials" $repo_url/releases/latest)
  release_id=$(echo ${res} | parse id | sed "s/{\?.*$//")

  if [[ -n "$release_id" ]]; then
    curl -v -XDELETE --user "$credentials" $repo_url/releases/$release_id
  else
    die "No releases found to prune"
  fi

}

provision()
{
  yum -y install aws-cli unzip
  chkconfig sshd off
  service sshd stop
  yum -y erase openssh-server

}

release()
{

  local credentials=$1
  local github_repository=keksipurkki/tunnelvision
  local repo_url=https://api.github.com/repos/$github_repository

  ARCHIVE=tunnelvision.zip

  if [[ ! -r "$ARCHIVE" ]]; then
    die "Nothing to upload. Aborting"
  fi

  if [[ -z "$credentials" ]]; then
    die "No Github credentials given. Aborting"
  fi

  IFS=: read GH_USER GH_TOKEN <<< "$credentials"
  GH_TARGET=master
  VERSION=$(date '+%Y%m%d%H%M')

  if ! curl -s --fail --user "$credentials" $repo_url >/dev/null; then
    die "No such repository $repo_url. Aborting."
  fi

  MESSAGE="Release on $(date) by @${GH_USER}"

  releases_url=https://api.github.com/repos/$github_repository/releases

  res=$(curl -# --user "$credentials" -X POST $releases_url \
    -d "
      {
        \"tag_name\": \"$(git rev-parse --short HEAD)\",
        \"target_commitish\": \"$GH_TARGET\",
        \"name\": \"$VERSION\",
        \"body\": \"$MESSAGE\",
        \"draft\": false,
        \"prerelease\": false
      }")

    echo $res | pretty

    upload_url=$(echo ${res} | parse upload_url | sed "s/{\?.*$//" )

    zip_upload_url=$upload_url?name=$(basename "$ARCHIVE" | urlencode)

    echo $upload_url

    res=$(curl -# --user "$credentials" "$zip_upload_url" -X POST \
      --header 'Content-Type: application/octet-stream' \
      --upload-file "$ARCHIVE" \
    )

    echo $res | pretty

    script_upload_url=$upload_url?name=tunnelvision.sh

    res=$(curl -# --user "$credentials" "$script_upload_url" -X POST \
      --header 'Content-Type: text/x-shellscript' \
      --upload-file "tunnelvision.sh" \
    )

    echo $res | pretty

}

launch()
{

  curl -sOL "https://github.com/keksipurkki/tunnelvision/releases/latest/download/tunnelvision.zip"
  unzip -q tunnelvision.zip
  release=$(echo tunnelvision-*)

  if [[ -d "$release" ]]; then
    echo Found $release
  else
    ls -R
    die "Failed to download the release"
  fi

  IFS=- read app version <<< "$release"

  cat << EOF
===================================================================

  Launching $app (revision: $version)

===================================================================
EOF

  mv .env $release
  cd $release
  docker swarm init
  docker stack deploy tunnelvision -c production.yml
}

cloudwatch_log()
{
  local input=$1
  log_stream=/keksipurkki/tunnelvision
  timestamp=$(( 1000 * $(date '+%s')))
  msg="timestamp=$timestamp,message=$(cat $1)"
  aws logs create-log-stream \
    --log-group-name $log_stream \
    --log-stream-name provision-$timestamp
  aws logs put-log-events \
    --log-group-name $log_stream \
    --log-stream-name provision-$timestamp \
    --log-events "$msg"
}

main()
{

  local cmd=$1
  case "$cmd" in
    run)
      provision
      launch | tee launch.log
      cloudwatch_log launch.log
      ;;
    release)
      # Credentials from the environment
      release ${GITHUB_CREDENTIALS}
      ;;
    prune)
      prune ${GITHUB_CREDENTIALS}
      ;;
    *)
      die "Unknown command $cmd"
  esac
}

main ${1:-run}
