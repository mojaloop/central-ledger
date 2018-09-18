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

is_service_up() {
  docker run --rm --network host byrnedo/alpine-curl -s -X PUT 'http://localhost:1080/status' -d '{"method": "*", "path": "*"}'
}

echo "Waiting for mockserver to start"
until is_service_up; do
  printf "."
  sleep $SLEEP_FACTOR_IN_SECONDS
done

echo
echo "Configuring expectation for mockserver"
docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:1080/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*transfers.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';

echo "---------------------------------------------------------------------"
echo "Ensure your ML-API-Adapter config points to the following end-points for callbacks:"
echo "Add the following entries to: \"DFSP_URLS\":"
echo "---------------------------------------------------------------------"
for FSP in "${FSPList[@]}"
do
  echo "    \"$FSP\": {"
  echo "      \"transfers\": {"
  echo "        \"post\": \"http://localhost:1080/$FSP/transfers\","
  echo "        \"put\": \"http://localhost:1080/$FSP/transfers/{{transferId}}\","
  echo "        \"error\": \"http://localhost:1080/$FSP/transfers/{{transferId}}/error\""
  echo "      }"
  echo "    },"
done
echo "---------------------------------------------------------------------"
echo

echo "${MOCKSERVER_ID} ready to accept requests..."
