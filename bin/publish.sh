#!/bin/bash

set -e

printf "Enter your Github token: "
read GITHUB_PASSWD

if [[ -z $GITHUB_PASSWD ]]; then
  echo Password cannot be empty >&2
  exit 1
fi

GITHUB_CREDENTIALS=keksipurkki:$GITHUB_PASSWD
GITHUB_REPOSITORY=keksipurkki/tunnelvision

function urlencode ()
{
  python -c "import urllib, sys; print urllib.quote(sys.stdin.read(), '\n\/')"
}

function parse()
{
  python -c "import json,sys;print(json.load(sys.stdin)[\"$1\"])"
}

function pretty()
{
  python -mjson.tool
}

function package() {
  local release=tunnelvision.zip
  test -r tunnelvision.zip
  echo $release
}

source .env

RELEASE=$(package)

IFS=: read GH_USER GH_TOKEN <<< "$GITHUB_CREDENTIALS"
GH_TARGET=master
VERSION=$(date '+%Y%m%d%H%M')

if [[ ! -r "$RELEASE"  ]]; then
  echo "Nothing to upload. Aborting" >&2
  exit 1
fi

repo_url=https://api.github.com/repos/$GITHUB_REPOSITORY

if ! curl -s --fail --user "$GITHUB_CREDENTIALS" $repo_url >/dev/null; then
  echo No such repository $repo_url. Aborting. >&2
  exit 1
fi

MESSAGE="Release on $(date) by @${GH_USER}"

releases_url=https://api.github.com/repos/$GITHUB_REPOSITORY/releases

res=$(curl -# --user "$GITHUB_CREDENTIALS" -X POST $releases_url \
  -d "
  {
    \"tag_name\": \"$(git rev-parse --short HEAD)\",
    \"target_commitish\": \"$GH_TARGET\",
    \"name\": \"$VERSION\",
    \"body\": \"$MESSAGE\",
    \"draft\": true,
    \"prerelease\": false
  }")

echo $res | pretty

upload_url=$(echo ${res} | parse upload_url | sed "s/{\?.*$//" )
upload_url+=?name=$(basename "$RELEASE" | urlencode)

echo $upload_url

res=$(curl -# --user "$GITHUB_CREDENTIALS" "$upload_url" -X POST \
  --header 'Content-Type: application/octet-stream' \
  --upload-file "$RELEASE" \
)

echo $res | pretty
