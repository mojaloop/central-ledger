#!/bin/bash

# reset kafka consumer group offsets for transfer prepares

docker exec cl_kafka /bin/sh -c "/opt/kafka_2.12-2.3.0/bin/kafka-consumer-groups.sh --bootstrap-server kafka:29092 --group cl-group-transfer-prepare --topic topic-transfer-prepare --reset-offsets --to-earliest --execute"
