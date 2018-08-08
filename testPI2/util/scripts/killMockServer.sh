#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting MockServer Kill Script..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

echo "Loading env vars..."
source $CWD/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Creating MockServer Instance"
echo "---------------------------------------------------------------------"
echo "Destroying MockServer ${MOCKSERVER_ID}"

docker stop $MOCKSERVER_ID
docker rm $MOCKSERVER_ID
