#!/bin/sh
# wait-for-mockserver.sh

source /opt/wait-for/wait-for.env

function healthCheck() {  
  curl -s -X GET "http://$WAIT_FOR_MOCK_HOST:$WAIT_FOR_MOCK_PORT"
}

function command() {
  curl -s -X PUT "http://$WAIT_FOR_MOCK_HOST:$WAIT_FOR_MOCK_PORT/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*transfers.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';
}

until healthCheck; do
  >&2 echo "mockserver is unavailable - sleeping"
  sleep 1
done

>&2 echo "mockserver is up - executing command"
command
