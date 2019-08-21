#!/bin/sh

echo "** STARTUP - Checking for Broker connection..."
sh /opt/wait-for/wait-for.sh $WAIT_FOR_DB_KAFKA_BROKER -- echo "** STARTUP - Kafka connection successful!"
