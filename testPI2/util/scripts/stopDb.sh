#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Database Stop Script..."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

echo "Loading env vars..."
source $CWD/$SCRIPT_DIR/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Stopping ${DB_ID} Instance"
echo "---------------------------------------------------------------------"
echo "Destroying ${DB_ID}"

docker stop $DB_ID
docker rm $DB_ID
