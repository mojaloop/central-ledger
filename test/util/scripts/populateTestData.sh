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

## Uncomment next line to debug a single FSP's onboarding script
# export FSPList=("dfsp1")

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
  echo "Get accounts list for '$FSP' and filter by ledgerAccountType='SETTLEMENT'"
  echo "---------------------------------------------------------------------"
  ACCOUNT_LIST=$(curl --silent -X GET "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/accounts" --header 'Cache-Control: no-cache' --header 'Content-Type: application/json' --header 'FSPIOP-Source: populateTestData.sh')
  ACCOUNT_ID=$(echo $ACCOUNT_LIST | jq '.[] | select(.ledgerAccountType == "SETTLEMENT") | .id')
  echo "Account list=$ACCOUNT_LIST"
  echo "Account with ledgerAccountType='SETTLEMENT' - ACCOUNT_ID=$ACCOUNT_ID"


  ## Generate TransferId for Funds-in
  FUNDS_IN_TRANSFER_ID=$(uuidgen)

  echo
  echo "Deposit funds for '$FSP' on account '$ACCOUNT_ID' with transferId='$FUNDS_IN_TRANSFER_ID'"
  echo "---------------------------------------------------------------------"
  curl --verbose -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/accounts/${ACCOUNT_ID}" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh' \
  --data-raw "{
    \"transferId\": \"${FUNDS_IN_TRANSFER_ID}\",
    \"externalReference\": \"populateTestData.sh\",
    \"action\": \"recordFundsIn\",
    \"reason\": \"populateTestData.sh\",
    \"amount\": {
        \"amount\": \"${DEFAULT_NET_DEBIT_CAP}\",
        \"currency\": \"USD\"
    }
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
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/transfers\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_PUT\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/fsp/${FSP}/participants/{{partyIdType}}/{{partyIdentifier}}\"
      }"

 curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_PARTIES_GET\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/fsp/${FSP}/parties/{{partyIdType}}/{{partyIdentifier}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_PUT\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/transfers/{{transferId}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_ERROR\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/transfers/{{transferId}}/error\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/bulkTransfers\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/bulkTransfers/{{id}}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}/bulkTransfers/{{id}}/error\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_QUOTES\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_AUTHORIZATIONS\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}/${FSP}\"
      }"

  curl -i -X POST "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'Content-Type: application/json' \
    --header 'FSPIOP-Source: populateTestData.sh' \
    --data-raw "{
        \"type\": \"FSPIOP_CALLBACK_URL_BULK_QUOTES\",
        \"value\": \"http://${MOCKSERVER_HOST}:${MOCKSERVER_PORT}\"
      }"

  echo
  echo "Retrieving EndPoints for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -i -X GET "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints" \
    --header 'Cache-Control: no-cache' \
    --header 'FSPIOP-Source: populateTestData.sh'

  echo
  echo "Get accounts list for '$FSP' to show balances"
  echo "---------------------------------------------------------------------"
  curl --silent -X GET "${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/accounts" \
  --header 'Cache-Control: no-cache' \
  --header 'Content-Type: application/json' \
  --header 'FSPIOP-Source: populateTestData.sh'

done

echo
