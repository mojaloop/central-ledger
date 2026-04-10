#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "---------------------------------------------------------------------"
echo "SETTLED for PAYER"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/1 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: 7d78bd18-2614-494a-9860-4236564df1c6' \
  -d '{
    \"participants\": [
      {
        \"id\": 2,
        \"accounts\": [
          {
            \"id\": 3,
            \"reason\": \"Payer: SETTLED, settlement: SETTLING\",
            \"state\": \"SETTLED\"
          }
        ]
      }
    ]
  }'"
echo

echo
echo "---------------------------------------------------------------------"
echo "SETTLED for PAYER - additional note"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/1 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: 7d78bd18-2614-494a-9860-4236564df1c6' \
  -d '{
    \"participants\": [
      {
        \"id\": 2,
        \"accounts\": [
          {
            \"id\": 3,
            \"reason\": \"Additional reason for SETTLED account\",
            \"state\": \"SETTLED\",
            \"externalReference\": \"tr98765432109876543210\"
          }
        ]
      }
    ]
  }'"
echo
echo
echo "Completed Scenario 11-5 - Settlement to SETTLING"
echo

sh $CWD/21scenario-part5-results.sh
