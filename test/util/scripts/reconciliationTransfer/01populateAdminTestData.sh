#!/usr/bin/env bash
echo "---------------------------------------------------------------------"
echo "Starting script to populate test data.."
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
echo " Creating TestData for $FSPList"
echo "---------------------------------------------------------------------"
echo " Prerequisites for Central-Ledger:"
echo "    1. Ensure you run 'npm run migrate'"
echo "    2. The below requests only work for the 'ADMIN' API"

echo
echo
echo "*********************************************************************"
echo "Creating Hub reconciliation account"
echo "---------------------------------------------------------------------"
sh -c "curl -X POST \
${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/Hub/accounts \
-H 'Content-Type: application/json' \
-H 'Postman-Token: 8fd1b601-432f-443c-a947-750f60380753' \
-H 'cache-control: no-cache' \
-d '{
  \"currency\": \"USD\",
  \"type\": \"HUB_RECONCILIATION\"
}'"

for FSP in "${FSPList[@]}"
do
  echo
  echo
  echo "*********************************************************************"
  echo "Creating participants '$FSP'"
  echo "---------------------------------------------------------------------"
  sh -c "curl -i -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"name\": \"$FSP\",
    \"currency\":\"USD\"
  }'"

  echo
  echo "Setting limits and initial position for '$FSP'"
  echo "---------------------------------------------------------------------"
  sh -c "curl -i -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/initialPositionAndLimits \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"currency\": \"USD\",
    \"limit\": {
      \"type\": \"NET_DEBIT_CAP\",
      \"value\": ${DEFAULT_NET_DEBIT_CAP}
    },
    \"initialPosition\": 0
  }'"

  echo
  echo "Retrieving limits for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -X GET \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/limits \
    -H 'Cache-Control: no-cache'

  echo
  echo "Set callback URIs for each FSP '$FSP'"
  echo "---------------------------------------------------------------------"
  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_POST\",
    \"value\": \"http://localhost:1080/${FSP}/transfers\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_PUT\",
    \"value\": \"http://localhost:1080/${FSP}/transfers/{{transferId}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_ERROR\",
    \"value\": \"http://localhost:1080/${FSP}/transfers/{{transferId}}/error\"
  }'"

  echo
  echo "Retrieving EndPoints for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -X GET \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache'

done

echo
