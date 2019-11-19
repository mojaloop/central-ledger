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

echo "Starting Docker ${MOCKSERVER_ID}{sim} with binding ${MOCK_SIM_PORT}:1080"
docker run --name ${MOCKSERVER_ID} -d -p ${MOCK_SIM_PORT}:1080 jamesdbloom/mockserver;

is_service_up() {
  docker run --rm --network host byrnedo/alpine-curl -s -X PUT "http://localhost:${MOCK_SIM_PORT}/status" -d '{"method": "*", "path": "*"}' > /dev/null 2>&1
}

echo "Waiting for mockserver to start"
while true; do
  sleep $SLEEP_FACTOR_IN_SECONDS
  if is_service_up; then break; fi
  printf "."
done

# echo
# echo "Configuring expectation for mockserver"
# docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:${MOCK_SIM_PORT}/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*transfers.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';
# docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:${MOCK_SIM_PORT}/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*quotes.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';
# docker run --rm --network host byrnedo/alpine-curl -X PUT "http://localhost:${MOCK_SIM_PORT}/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*bulkTransfers.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';

echo "${MOCKSERVER_ID} ready to accept requests..."
