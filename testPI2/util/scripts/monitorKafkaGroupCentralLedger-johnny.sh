#!/usr/bin/env bash

CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

docker exec -t $KAFKA_ID sh -c "while true; do ./opt/kafka_2.12-1.1.1/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group central-ledger-kafka --describe; sleep 5; done"
