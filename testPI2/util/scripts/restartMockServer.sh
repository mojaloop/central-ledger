#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting MockServer Restart Script..."
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
echo " Creating MockServer Instance"
echo "---------------------------------------------------------------------"

echo
echo "Destroying MockServer ${MOCKSERVER_ID}"

docker stop $MOCKSERVER_ID
docker rm $MOCKSERVER_ID

echo "Starting Docker ${MOCKSERVER_ID}"
docker run --name ${MOCKSERVER_ID} -d -p 1080:1080 jamesdbloom/mockserver;

echo
echo "Sleeping for ${SLEEP_FACTOR_IN_SECONDS}s for ${MOCKSERVER_ID} startup..."
sleep $SLEEP_FACTOR_IN_SECONDS
echo

echo
echo "Configuring expectation for POST /transfers"
docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:1080/expectation" -d '{ "httpRequest": { "method": "POST", "path": "/transfers(.*)" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';

echo
echo "Configuring expectation for PUT /transfers"
docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:1080/expectation" -d '{ "httpRequest": { "method": "PUT", "path": "/transfers(.*)" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';

echo "---------------------------------------------------------------------"
echo "Ensure your ML-API-Adapter config points to the following end-points for callbacks:"
echo "Add the following entries to: \"DFSP_URLS\":"
  echo "    ------------------------------------------------------"
for FSP in "${FSPList[@]}"
do
  echo "    \"$FSP\": {"
  echo "      \"transfers\": {"
  echo "        \"post\": \"http://localhost:1080/transfers\","
  echo "        \"put\": \"http://localhost:1080/transfers/{{transferId}}\","
  echo "        \"error\": \"http://localhost:1080/transfers/{{transferId}}/error\""
  echo "      }"
  echo "    }"
  echo "    ------------------------------------------------------"
done
echo

echo "${MOCKSERVER_ID} ready to accept requests..."
