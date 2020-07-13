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
curl -X POST \
  ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/Hub/accounts \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'cache-control: no-cache' \
  -d '{
    "currency": "USD",
    "type": "HUB_RECONCILIATION"
}'

echo "---------------------------------------------------------------------"
echo "Creating Hub Multilateral Net Settlement account for the Scheme so that participant accounts in that currency can be created."
echo "---------------------------------------------------------------------"
curl -X POST \
  ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/Hub/accounts \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'cache-control: no-cache' \
  -d '{
    "currency": "USD",
    "type": "HUB_MULTILATERAL_SETTLEMENT"
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
    \"value\": \"http://localhost:8444/${FSP}/transfers\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_PUT\",
    \"value\": \"http://localhost:8444/${FSP}/participants/{{partyIdType}}/{{partyIdentifier}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTIES_GET\",
    \"value\": \"http://localhost:8444/${FSP}/parties/{{partyIdType}}/{{partyIdentifier}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_PUT_ERROR\",
    \"value\": \"http://localhost:8444/${FSP}/participants/{{partyIdType}}/{{partyIdentifier}}/error\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT\",
    \"value\": \"http://localhost:8444/${FSP}/participants/{{requestId}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTICIPANT_BATCH_PUT_ERROR\",
    \"value\": \"http://localhost:8444/${FSP}\/participants/{{requestId}}/error\"
   }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTIES_PUT\",
    \"value\": \"http://localhost:8444/${FSP}/parties/{{partyIdType}}/{{partyIdentifier}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_PARTIES_PUT_ERROR\",
    \"value\": \"http://localhost:8444/${FSP}/parties/{{partyIdType}}/{{partyIdentifier}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_PUT\",
    \"value\": \"http://localhost:8444/${FSP}/transfers/{{transferId}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRANSFER_ERROR\",
    \"value\": \"http://localhost:8444/${FSP}/transfers/{{transferId}}/error\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST\",
    \"value\": \"http://localhost:8444/${FSP}/bulkTransfers\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT\",
    \"value\": \"http://localhost:8444/${FSP}/bulkTransfers/{{id}}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR\",
    \"value\": \"http://localhost:8444/${FSP}/bulkTransfers/{{id}}/error\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_QUOTES\",
    \"value\": \"http://localhost:8444/${FSP}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_AUTHORIZATIONS\",
    \"value\": \"http://localhost:8444/${FSP}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE\",
    \"value\": \"http://localhost:8444/${FSP}\"
  }'"

  sh -c "curl -X POST \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache' \
    -H 'Content-Type: application/json' \
    -d '{
    \"type\": \"FSPIOP_CALLBACK_URL_BULK_QUOTES\",
    \"value\": \"http://localhost:8444\"
  }'"

  echo
  echo "Retrieving EndPoints for '$FSP'"
  echo "---------------------------------------------------------------------"
  curl -X GET \
    ${CENTRAL_LEDGER_ADMIN_URI_PREFIX}://${CENTRAL_LEDGER_ADMIN_HOST}:${CENTRAL_LEDGER_ADMIN_PORT}${CENTRAL_LEDGER_ADMIN_BASE}participants/${FSP}/endpoints \
    -H 'Cache-Control: no-cache'

done

echo
