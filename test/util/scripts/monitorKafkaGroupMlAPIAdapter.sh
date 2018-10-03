#!/usr/bin/env bash

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

docker exec -t $KAFKA_ID sh -c "while true; do ./opt/kafka_2.11-0.10.1.0/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group kafka-ml-api-adapter --describe; sleep 5; done"
