#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Kafka Kill Script..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Stopping Docker Kafka Instance"
echo "---------------------------------------------------------------------"
echo "Destroying Docker ${KAFKA_ID}"

docker stop $KAFKA_ID
docker rm $KAFKA_ID
