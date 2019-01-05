#!/bin/sh

set -o errexit
set -o nounset

export AWS_PROFILE=valuemotive

REPO_ROOT=$(cd "${0%/*}"/..; pwd)
COMMIT=$(git rev-parse --short HEAD)
REPOSITORY=806232589401.dkr.ecr.eu-north-1.amazonaws.com/tunnelvision
ENVIRONMENT=production

CLUSTER=tunnelvision
TASK_DEFINITON=tunnelvision-task-definition
SERVICE=tunnelvision-service

# Build the latest image and update local Docker repository
function build()
{
  cd $REPO_ROOT
  docker build -t $REPOSITORY:latest --build-arg NODE_ENV=$ENVIRONMENT --build-arg COMMIT=$COMMIT .
  docker tag $REPOSITORY:latest $REPOSITORY:$COMMIT
}

# Push image to remote Docker repository
function push()
{
  $(aws ecr get-login --no-include-email --region eu-north-1)
  docker push $REPOSITORY:latest
  docker push $REPOSITORY:$COMMIT
}

# Run latest registry
function deploy()
{
  aws ecs update-service --force-new-deployment \
                         --cluster $CLUSTER \
                         --service $SERVICE \
                         --task-definition $TASK_DEFINITON
}

function main()
{
  local step=${1:-build}
  case "$step" in
    build)
      echo -- Building the Dockerfile
      build
      ;;
    push)
      main build
      echo -- Pushing to ECR repository
      push
      ;;
    deploy)
      main push
      echo -- Redeploying
      deploy
      ;;
    *)
      echo Unknown step $step >&2
      exit 1
      ;;
  esac
}

cat << EOF

COMMIT=$COMMIT
ENVIRONMENT=$ENVIRONMENT

EOF

main $@
