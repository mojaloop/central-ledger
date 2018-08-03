#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting MockServer Stop Script..."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

echo "Loading env vars..."
source $CWD/$SCRIPT_DIR/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Creating MockServer Instance"
echo "---------------------------------------------------------------------"
echo "Destroying MockServer ${MOCKSERVER_ID}"

docker stop $MOCKSERVER_ID
docker rm $MOCKSERVER_ID
