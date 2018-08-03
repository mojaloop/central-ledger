#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Kafka Stop Script..."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

echo "Loading env vars..."
source $CWD/$SCRIPT_DIR/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Stopping Docker Kafka Instance"
echo "---------------------------------------------------------------------"
echo "Destroying Docker ${KAFKA_ID}"

docker stop $KAFKA_ID
docker rm $KAFKA_ID
