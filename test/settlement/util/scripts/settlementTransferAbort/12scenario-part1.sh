#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

echo "---------------------------------------------------------------------"
echo "Transfer prepare"
echo "---------------------------------------------------------------------"

echo "PAYER=dfsp1, PAYEE=dfsp2, amount=100"
sh -c "curl -X POST \
  http://localhost:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp2' \
  -H 'FSPIOP-Source: dfsp1' \
  -H 'Postman-Token: 52f127ff-7ed6-41c8-951e-c82276539b1d' \
  -d '{
    \"transferId\": \"123ec534-ee48-4575-b6a9-ead2955b8311\",
    \"payerFsp\": \"dfsp1\",
    \"payeeFsp\": \"dfsp2\",
    \"amount\": {
      \"currency\": \"USD\",
      \"amount\": \"100\"
    },
    \"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
    \"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
    \"expiration\": \"$EXPIRATION_DATE\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"prepare\",
        \"value\": \"Detailed prepare description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for transfer prepare..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Transfer fulfil"
echo "---------------------------------------------------------------------"
echo
sh -c "curl -X PUT \
  http://localhost:3000/transfers/123ec534-ee48-4575-b6a9-ead2955b8311 \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp1' \
  -H 'FSPIOP-Source: dfsp2' \
  -H 'Postman-Token: 13197130-8434-4707-a130-9e2816a94cc8' \
  -d '{
    \"fulfilment\": \"f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA\",
    \"transferState\": \"COMMITTED\",
    \"completedTimestamp\": \"2018-10-09T08:00:00.000-03:00\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"fulfilmentDetail\",
        \"value\": \"Detailed fulfil description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for the transfer commit..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Sending requests to central-settlement"
echo "---------------------------------------------------------------------"
echo "Close settlement window ID=1"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlementWindows/1 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a2a0d43c-f11e-4b5b-bd80-cbd050dad451' \
  -d '{
    \"state\": \"CLOSED\",
    \"reason\": \"Settlement transfer abort test script\"
  }'"
echo
echo "Create settlement for settlement window ID=1"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlements \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a57f4181-19e7-4c17-858e-91c12c17b5e2' \
  -d '{
    \"reason\": \"To be aborted from PENDING_SETTLEMENT\",
    \"settlementWindows\": [
      {
        \"id\": 1
      }
    ]
  }'"
echo

echo "---------------------------------------------------------------------"
echo "Transfer prepare"
echo "---------------------------------------------------------------------"

echo "PAYER=dfsp1, PAYEE=dfsp2, amount=200"
sh -c "curl -X POST \
  http://localhost:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp2' \
  -H 'FSPIOP-Source: dfsp1' \
  -H 'Postman-Token: 52f127ff-7ed6-41c8-951e-c82276539b1d' \
  -d '{
    \"transferId\": \"123ec534-ee48-4575-b6a9-ead2955b8312\",
    \"payerFsp\": \"dfsp1\",
    \"payeeFsp\": \"dfsp2\",
    \"amount\": {
      \"currency\": \"USD\",
      \"amount\": \"200\"
    },
    \"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
    \"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
    \"expiration\": \"$EXPIRATION_DATE\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"prepare\",
        \"value\": \"Detailed prepare description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for transfer prepare..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Transfer fulfil"
echo "---------------------------------------------------------------------"
echo
sh -c "curl -X PUT \
  http://localhost:3000/transfers/123ec534-ee48-4575-b6a9-ead2955b8312 \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp1' \
  -H 'FSPIOP-Source: dfsp2' \
  -H 'Postman-Token: 13197130-8434-4707-a130-9e2816a94cc8' \
  -d '{
    \"fulfilment\": \"f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA\",
    \"transferState\": \"COMMITTED\",
    \"completedTimestamp\": \"2018-10-09T08:00:00.000-03:00\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"fulfilmentDetail\",
        \"value\": \"Detailed fulfil description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for the transfer commit..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Sending requests to central-settlement"
echo "---------------------------------------------------------------------"
echo "Close settlement window ID=2"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlementWindows/2 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a2a0d43c-f11e-4b5b-bd80-cbd050dad451' \
  -d '{
    \"state\": \"CLOSED\",
    \"reason\": \"Settlement transfer abort test script\"
  }'"
echo
echo "Create settlement for settlement window ID=2"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlements \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a57f4181-19e7-4c17-858e-91c12c17b5e2' \
  -d '{
    \"reason\": \"To be aborted from PS_TRANSFERS_RECORDED\",
    \"settlementWindows\": [
      {
        \"id\": 2
      }
    ]
  }'"
echo
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_RECORDED for PAYER & PAYEE"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/2 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      },
      {
        \"id\": 3,
        \"accounts\": [
          {
            \"id\": 5,
            \"reason\": \"Transfers recorded for payee\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      }
    ]
  }'"
echo
echo

echo "---------------------------------------------------------------------"
echo "Transfer prepare"
echo "---------------------------------------------------------------------"

echo "PAYER=dfsp1, PAYEE=dfsp2, amount=400"
sh -c "curl -X POST \
  http://localhost:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp2' \
  -H 'FSPIOP-Source: dfsp1' \
  -H 'Postman-Token: 52f127ff-7ed6-41c8-951e-c82276539b1d' \
  -d '{
    \"transferId\": \"123ec534-ee48-4575-b6a9-ead2955b8313\",
    \"payerFsp\": \"dfsp1\",
    \"payeeFsp\": \"dfsp2\",
    \"amount\": {
      \"currency\": \"USD\",
      \"amount\": \"400\"
    },
    \"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
    \"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
    \"expiration\": \"$EXPIRATION_DATE\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"prepare\",
        \"value\": \"Detailed prepare description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for transfer prepare..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Transfer fulfil"
echo "---------------------------------------------------------------------"
echo
sh -c "curl -X PUT \
  http://localhost:3000/transfers/123ec534-ee48-4575-b6a9-ead2955b8313 \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp1' \
  -H 'FSPIOP-Source: dfsp2' \
  -H 'Postman-Token: 13197130-8434-4707-a130-9e2816a94cc8' \
  -d '{
    \"fulfilment\": \"f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA\",
    \"transferState\": \"COMMITTED\",
    \"completedTimestamp\": \"2018-10-09T08:00:00.000-03:00\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"fulfilmentDetail\",
        \"value\": \"Detailed fulfil description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for the transfer commit..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Sending requests to central-settlement"
echo "---------------------------------------------------------------------"
echo "Close settlement window ID=3"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlementWindows/3 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a2a0d43c-f11e-4b5b-bd80-cbd050dad451' \
  -d '{
    \"state\": \"CLOSED\",
    \"reason\": \"Settlement transfer abort test script\"
  }'"
echo
echo "Create settlement for settlement window ID=3"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlements \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a57f4181-19e7-4c17-858e-91c12c17b5e2' \
  -d '{
    \"reason\": \"To be aborted from PS_TRANSFERS_RESERVED\",
    \"settlementWindows\": [
      {
        \"id\": 3
      }
    ]
  }'"
echo
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_RECORDED for PAYER & PAYEE"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/3 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      },
      {
        \"id\": 3,
        \"accounts\": [
          {
            \"id\": 5,
            \"reason\": \"Transfers recorded for payee\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      }
    ]
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_RESERVED for PAYER & PAYEE"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/3 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_RESERVED\"
          }
        ]
      },
      {
        \"id\": 3,
        \"accounts\": [
          {
            \"id\": 5,
            \"reason\": \"Transfers recorded for payee\",
            \"state\": \"PS_TRANSFERS_RESERVED\"
          }
        ]
      }
    ]
  }'"
echo
echo

echo "---------------------------------------------------------------------"
echo "Transfer prepare"
echo "---------------------------------------------------------------------"

echo "PAYER=dfsp1, PAYEE=dfsp2, amount=800"
sh -c "curl -X POST \
  http://localhost:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp2' \
  -H 'FSPIOP-Source: dfsp1' \
  -H 'Postman-Token: 52f127ff-7ed6-41c8-951e-c82276539b1d' \
  -d '{
    \"transferId\": \"123ec534-ee48-4575-b6a9-ead2955b8314\",
    \"payerFsp\": \"dfsp1\",
    \"payeeFsp\": \"dfsp2\",
    \"amount\": {
      \"currency\": \"USD\",
      \"amount\": \"800\"
    },
    \"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
    \"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
    \"expiration\": \"$EXPIRATION_DATE\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"prepare\",
        \"value\": \"Detailed prepare description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for transfer prepare..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Transfer fulfil"
echo "---------------------------------------------------------------------"
echo
sh -c "curl -X PUT \
  http://localhost:3000/transfers/123ec534-ee48-4575-b6a9-ead2955b8314 \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1' \
  -H 'Date: Fri, 14 Sep 2018 19:10:56 GMT' \
  -H 'FSPIOP-Destination: dfsp1' \
  -H 'FSPIOP-Source: dfsp2' \
  -H 'Postman-Token: 13197130-8434-4707-a130-9e2816a94cc8' \
  -d '{
    \"fulfilment\": \"f5sqb7tBTWPd5Y8BDFdMm9BJR_MNI4isf8p8n4D5pHA\",
    \"transferState\": \"COMMITTED\",
    \"completedTimestamp\": \"2018-10-09T08:00:00.000-03:00\",
    \"extensionList\": {
      \"extension\": [{
        \"key\": \"fulfilmentDetail\",
        \"value\": \"Detailed fulfil description\"
      }]
    }
  }'"
echo "Awaiting $SLEEP_FACTOR_IN_SECONDS seconds for the transfer commit..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo "---------------------------------------------------------------------"
echo "Sending requests to central-settlement"
echo "---------------------------------------------------------------------"
echo "Close settlement window ID=4"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlementWindows/4 \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a2a0d43c-f11e-4b5b-bd80-cbd050dad451' \
  -d '{
    \"state\": \"CLOSED\",
    \"reason\": \"Settlement transfer abort test script\"
  }'"
echo
echo "Create settlement for settlement window ID=4"
sh -c "curl -X POST \
  http://localhost:3007/v2/settlements \
  -H 'Cache-Control: no-cache' \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: a57f4181-19e7-4c17-858e-91c12c17b5e2' \
  -d '{
    \"reason\": \"To be aborted from PS_TRANSFERS_COMMITTED\",
    \"settlementWindows\": [
      {
        \"id\": 4
      }
    ]
  }'"
echo
echo ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>"
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_RECORDED for PAYER & PAYEE"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/4 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      },
      {
        \"id\": 3,
        \"accounts\": [
          {
            \"id\": 5,
            \"reason\": \"Transfers recorded for payee\",
            \"state\": \"PS_TRANSFERS_RECORDED\"
          }
        ]
      }
    ]
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_RESERVED for PAYER & PAYEE"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/4 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_RESERVED\"
          }
        ]
      },
      {
        \"id\": 3,
        \"accounts\": [
          {
            \"id\": 5,
            \"reason\": \"Transfers recorded for payee\",
            \"state\": \"PS_TRANSFERS_RESERVED\"
          }
        ]
      }
    ]
  }'"
echo
echo
echo "---------------------------------------------------------------------"
echo "PS_TRANSFERS_COMMITTED for PAYER"
echo "---------------------------------------------------------------------"
sh -c "curl -X PUT \
  http://localhost:3007/v2/settlements/4 \
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
            \"reason\": \"Transfers recorded for payer\",
            \"state\": \"PS_TRANSFERS_COMMITTED\"
          }
        ]
      }
    ]
  }'"
echo
echo

echo "Completed Scenario 12-1 - Prepare and fulfil 4 transfers, 4 windows and 4 settlements"
echo

sh $CWD/22scenario-part1-results.sh
