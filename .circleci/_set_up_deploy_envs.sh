#!/usr/bin/env bash
set -o nounset


if [[ ${CIRCLE_TAG} =~ v[0-9]+(\.[0-9]+)*(\-snapshot) ]]; then
  echo "Setting snap shot env vars for ${CIRCLE_TAG}"

  echo 'export RELEASE_TAG=$RELEASE_TAG_SNAPSHOT' >> $BASH_ENV
  echo 'export HELM_VALUE_FILENAME=$K8_HELM_VALUE_FILENAME_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_CLUSTER_SERVER=$K8_CLUSTER_SERVER_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_RELEASE_NAME=$K8_RELEASE_NAME_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_NAMESPACE=$K8_NAMESPACE_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_USER_NAME=$K8_USER_NAME_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_USER_TOKEN=$K8_USER_TOKEN_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_HELM_CHART_NAME=$K8_HELM_CHART_NAME_SNAPSHOT' >> $BASH_ENV
  echo 'export K8_HELM_CHART_VERSION=$K8_HELM_CHART_VERSION_SNAPSHOT' >> $BASH_ENV
  echo 'export HELM_VALUE_SET_VALUES="--set central.centralhub.centralledger.containers.api.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.api.image.tag=$CIRCLE_TAG --set central.centralhub.centralledger.containers.admin.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.admin.image.tag=$CIRCLE_TAG"' >> $BASH_ENV

  exit 0
fi

if [[ ${CIRCLE_TAG} =~ v[0-9]+(\.[0-9]+)*(\-hotfix) ]]; then
  echo "Setting hotfix env vars for ${CIRCLE_TAG}"

  echo 'export RELEASE_TAG=$RELEASE_TAG_PROD' >> $BASH_ENV
  exit 0
fi

if [[ ${CIRCLE_TAG} =~ v[0-9]+(\.[0-9]+)* ]]; then
  echo "Setting prod env vars for ${CIRCLE_TAG}"

  echo 'export RELEASE_TAG=$RELEASE_TAG_PROD' >> $BASH_ENV
  echo 'export HELM_VALUE_FILENAME=$K8_HELM_VALUE_FILENAME_PROD' >> $BASH_ENV
  echo 'export K8_CLUSTER_SERVER=$K8_CLUSTER_SERVER_PROD' >> $BASH_ENV
  echo 'export K8_RELEASE_NAME=$K8_RELEASE_NAME_PROD' >> $BASH_ENV
  echo 'export K8_NAMESPACE=$K8_NAMESPACE_PROD' >> $BASH_ENV
  echo 'export K8_USER_NAME=$K8_USER_NAME_PROD' >> $BASH_ENV
  echo 'export K8_USER_TOKEN=$K8_USER_TOKEN_PROD' >> $BASH_ENV
  echo 'export K8_HELM_CHART_NAME=$K8_HELM_CHART_NAME_PROD' >> $BASH_ENV
  echo 'export K8_HELM_CHART_VERSION=$K8_HELM_CHART_VERSION_PROD' >> $BASH_ENV
  echo 'export HELM_VALUE_SET_VALUES="--set central.centralhub.centralledger.containers.api.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.api.image.tag=$CIRCLE_TAG --set central.centralhub.centralledger.containers.admin.image.repository=$DOCKER_ORG/$CIRCLE_PROJECT_REPONAME --set central.centralhub.centralledger.containers.admin.image.tag=$CIRCLE_TAG"' >> $BASH_ENV

  exit 0
fi

echo "No valid match found for CIRCLE_TAG: ${CIRCLE_TAG}"
exit 1