#!/bin/sh
# wait-for-mockserver.sh

function healthCheck() {  
  curl -s -X GET "http://$MOCK_HOST:1080"
}

function command() {
  curl -s -X PUT "http://$MOCK_HOST:1080/expectation" -d '{ "httpRequest": { "method": ".*", "path": "/.*transfers.*" }, "times" : { "remainingTimes" : 0,	"unlimited" : true }, "timeToLive" : { "unlimited" : true }, "httpResponse": { "statusCode": 200, "body": "{}" } }';
}

until healthCheck; do
  >&2 echo "mockserver is unavailable - sleeping"
  sleep 1
done

>&2 echo "mockserver is up - executing command"
command

