#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting script to populate test data.."
echo "---------------------------------------------------------------------"
echo

CWD=$(dirname $(cd "$(dirname "$BASH_SOURCE")"; pwd))

echo "Loading env vars..."
source $CWD/$SCRIPT_DIR/env.sh

echo
echo "---------------------------------------------------------------------"
echo " Creating TestData for $FSP1 & $FSP2"
echo "---------------------------------------------------------------------"
echo " Prerequisites for Central-Ledger:"
echo "    1. Ensure you run 'npm run migrate'"
echo "    2. The below requests only work for the 'ADMIN' API'"

echo
echo "Creating participants '$FSP1'"
echo "---------------------------------------------------------------------"
sh -c "curl -i -X POST \
  http://localhost:3001/participants \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -d '{
	\"name\": \"${FSP1}\",
	\"currency\":\"USD\"
}'"

echo
echo "Setting limits and initial position for '$FSP1'"
echo "---------------------------------------------------------------------"
curl -i -X POST \
  http://localhost:3001/participants/$FSP1/initialPositionAndLimits \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -d '{
  "currency": "USD",
  "limit": {
    "type": "NET_DEBIT_CAP",
    "value": 1000
  },
  "initialPosition": 0
}'

echo
echo "Retrieving limits for '$FSP1'"
echo "---------------------------------------------------------------------"
curl -X GET \
  http://localhost:3001/participants/$FSP1/limits \
  -H 'Cache-Control: no-cache'

echo ''
echo "*********************************************************************"
echo ''

echo
echo "Creating participants '$FSP2'"
echo "---------------------------------------------------------------------"
sh -c "curl -i -X POST \
  http://localhost:3001/participants \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -d '{
	\"name\": \"${FSP2}\",
	\"currency\":\"USD\"
}'"

echo
echo "Setting limits and initial position for '$FSP2'"
echo "---------------------------------------------------------------------"
curl -i -X POST \
  http://localhost:3001/participants/$FSP2/initialPositionAndLimits \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -d '{
  "currency": "USD",
  "limit": {
    "type": "NET_DEBIT_CAP",
    "value": 1000
  },
  "initialPosition": 0
}'

echo
echo "Retrieving limits for '$FSP2'"
echo "---------------------------------------------------------------------"
curl -X GET \
  http://localhost:3001/participants/$FSP2/limits \
  -H 'Cache-Control: no-cache'

echo
