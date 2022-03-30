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

echo "---------------------------------------------------------------------"
echo "Creating Hub Reconciliation account for the Scheme so that participant accounts in that currency can be created."
echo "---------------------------------------------------------------------"
curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/Hub/accounts" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw '{
      "currency": "USD",
      "type": "HUB_RECONCILIATION"
    }'

echo
echo "---------------------------------------------------------------------"
echo "Creating Hub Multilateral Net Settlement account for the Scheme so that participant accounts in that currency can be created."
echo "---------------------------------------------------------------------"
curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/Hub/accounts" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw '{
      "currency": "USD",
      "type": "HUB_MULTILATERAL_SETTLEMENT"
    }'

echo
echo "---------------------------------------------------------------------"
echo "Creating default Settlement Model."
echo "---------------------------------------------------------------------"
curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}settlementModels" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw '{
      "name": "DEFERREDNET",
      "settlementGranularity": "NET",
      "settlementInterchange": "MULTILATERAL",
      "settlementDelay": "DEFERRED",
      "requireLiquidityCheck": true,
      "ledgerAccountType": "POSITION",
      "autoPositionReset": true,
      "currency": "USD",
      "settlementAccountType": "SETTLEMENT"
    }'

echo
echo "---------------------------------------------------------------------"
echo " Creating TestData for $FSPList"
echo "---------------------------------------------------------------------"
echo " Prerequisites for Central-Ledger:"
echo "    1. Ensure you run 'npm run migrate'"
echo "    2. The below requests only work for the 'ADMIN' API"

for FSP in "${FSPList[@]}"
do
  echo ''
  echo "*********************************************************************"
  echo ''
  echo
  echo "Creating participants '$FSP'"
  echo "---------------------------------------------------------------------"
curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw "{
      \"name\": \"$FSP\",
      \"currency\":\"USD\"
    }"

  echo
  echo "Setting limits and initial position for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/initialPositionAndLimits" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw "{
    \"currency\": \"USD\",
    \"limit\": {
      \"type\": \"NET_DEBIT_CAP\",
      \"value\": ${DEFAULT_NET_DEBIT_CAP}
    },
    \"initialPosition\": 0
  }"

  echo
  echo "Retrieving limits for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -X GET "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/limits" -H 'Cache-Control: no-cache'

  echo
  echo "Set callback URIs for each FSP '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_POST\",
        \"value\": \"http://localhost:1080/${FSP}/transfers\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_PUT\",
        \"value\": \"http://localhost:1080/fsp/${FSP}/participants/{{partyIdType}}/{{partyIdentifier}}\"
      }"

 curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_PARTIES_GET\",
        \"value\": \"http://localhost:1080/fsp/${FSP}/parties/{{partyIdType}}/{{partyIdentifier}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_PUT\",
        \"value\": \"http://localhost:1080/${FSP}/transfers/{{transferId}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_ERROR\",
        \"value\": \"http://localhost:1080/${FSP}/transfers/{{transferId}}/error\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST\",
        \"value\": \"http://localhost:1080/${FSP}/bulkTransfers\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT\",
        \"value\": \"http://localhost:1080/${FSP}/bulkTransfers/{{id}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR\",
        \"value\": \"http://localhost:1080/${FSP}/bulkTransfers/{{id}}/error\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_QUOTES\",
        \"value\": \"http://localhost:1080/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_AUTHORIZATIONS\",
        \"value\": \"http://localhost:1080/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE\",
        \"value\": \"http://localhost:1080/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_QUOTES\",
        \"value\": \"http://localhost:1080\"
      }"

  echo
  echo "Retrieving EndPoints for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -i -X GET "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'FSPIOP-Source: populateTestData.sh'

done

echo
