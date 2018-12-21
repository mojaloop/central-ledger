#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

echo "---------------------------------------------------------------------"
echo "RecordFundsOut ABORT 50 - manual"
echo "---------------------------------------------------------------------"

echo "Sending request for aborting 50 USD from dfsp1 settlement account"
sh -c "curl -X PUT \
  http://127.0.0.1:3001/participants/dfsp1/accounts/4/transfers/523ec634-ef48-6575-a6a0-ded2955b8104 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: 88f1e4bc-9c15-4628-85c5-6208d71d981a' \
  -H 'cache-control: no-cache' \
  -d '{
    \"action\": \"recordFundsOutAbort\",
    \"reason\": \"Reason for abort out flow of funds\"
  }'"
echo 
echo 
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for the transfer abort to happen..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo
echo "Completed Scenario 11-6 - Reconciliation transfer manual abort (recordsFundsOutAbort)"
echo

sh $CWD/21scenario-part6-results.sh
