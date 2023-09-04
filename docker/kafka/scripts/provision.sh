#!/bin/bash

KAFKAHOST="${1:-kafka}"
KAFKAPORT="${2:-29092}"

# blocks until kafka is reachable
echo -e "------------------------------------------"
echo -e "Listing current kafka topics"
echo -e "__________________________________________"
kafka-topics.sh --bootstrap-server $KAFKAHOST:$KAFKAPORT --list
echo -e ""
echo -e "------------------------------------------"
echo -e "Creating kafka topics"
echo -e "__________________________________________"


# List of topics to create
topics=(
  "topic-transfer-prepare"
  "topic-transfer-position"
  "topic-transfer-fulfil"
  "topic-notification-event"
  "topic-transfer-get"
  "topic-admin-transfer"
  "topic-bulk-prepare"
  "topic-bulk-fulfil"
  "topic-bulk-processing"
  "topic-bulk-get"
)

# Loop through the topics and create them using kafka-topics.sh
for topic in "${topics[@]}"
do
  echo -e "--> Creating topic $topic..."
  kafka-topics.sh --bootstrap-server $KAFKAHOST:$KAFKAPORT --create --if-not-exists --topic "$topic" --replication-factor 1 --partitions 1
done

echo -e ""
echo -e "------------------------------------------"
echo -e "Successfully created the following topics:"
echo -e "__________________________________________"
kafka-topics.sh --bootstrap-server $KAFKAHOST:$KAFKAPORT --list
