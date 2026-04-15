#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "---------------------------------------------------------------------"
echo "Abort from PENDING_SETTLEMENT"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://127.0.0.1:3007/v2/settlements/1 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: adea248c-ac2f-41b3-9386-70c328fbcfa8' \
  -H 'cache-control: no-cache' \
  -d '{
    \"state\": \"ABORTED\",
    \"reason\": \"Abort from PENDING_SETTLEMENT\",
    \"externalReference\": \"1\"
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "Abort from PS_TRANSFERS_RECORDED"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://127.0.0.1:3007/v2/settlements/2 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: adea248c-ac2f-41b3-9386-70c328fbcfa8' \
  -H 'cache-control: no-cache' \
  -d '{
    \"state\": \"ABORTED\",
    \"reason\": \"Abort from PS_TRANSFERS_RECORDED\",
    \"externalReference\": \"2\"
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "Abort from PS_TRANSFERS_RESERVED"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://127.0.0.1:3007/v2/settlements/3 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: adea248c-ac2f-41b3-9386-70c328fbcfa8' \
  -H 'cache-control: no-cache' \
  -d '{
    \"state\": \"ABORTED\",
    \"reason\": \"Abort from PS_TRANSFERS_RESERVED\",
    \"externalReference\": \"3\"
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "Abort from PS_TRANSFERS_COMMITTED (1) - not allowed"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://127.0.0.1:3007/v2/settlements/4 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: adea248c-ac2f-41b3-9386-70c328fbcfa8' \
  -H 'cache-control: no-cache' \
  -d '{
    \"state\": \"ABORTED\",
    \"reason\": \"Abort from PS_TRANSFERS_COMMITTED\",
    \"externalReference\": \"4\"
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "Abort from ABORTED"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://127.0.0.1:3007/v2/settlements/1 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: adea248c-ac2f-41b3-9386-70c328fbcfa8' \
  -H 'cache-control: no-cache' \
  -d '{
    \"state\": \"ABORTED\",
    \"reason\": \"Abort from ABORTED\",
    \"externalReference\": \"11\"
  }'"
echo
echo

echo "Completed Scenario 12-2 - Multiple settlement ABORT operations"
echo

sh $CWD/22scenario-part2-results.sh
