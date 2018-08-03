#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting Kafka Restart Script..."
echo "---------------------------------------------------------------------"
echo

CWD="${0%/*}"

echo "Loading env vars..."
source $CWD/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Creating Docker Kafka Instance"
echo "---------------------------------------------------------------------"
echo "Destroying Docker ${KAFKA_ID}"

docker stop $KAFKA_ID
docker rm $KAFKA_ID

docker run -td --name=${KAFKA_ID} -p 2181:2181 -p 9092:9092 -e ADVERTISED_HOST=localhost  johnnypark/kafka-zookeeper
echo "Starting Docker ${KAFKA_ID}"

echo
echo "Sleeping for ${SLEEP_FACTOR_IN_SECONDS}s for Kafka startup..."
sleep $SLEEP_FACTOR_IN_SECONDS
echo
