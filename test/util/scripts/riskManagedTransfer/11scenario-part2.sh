#!/usr/bin/env bash
CWD="${0%/*}"

if [[ "$CWD" =~ ^(.*)\.sh$ ]];
then
    CWD="."
fi

echo "Loading env vars..."
source $CWD/env.sh

echo "---------------------------------------------------------------------"
echo "Disable dfsp1 at participant level"
echo "---------------------------------------------------------------------"

echo "Sending request to central-ledger admin API..."
sh -c "curl -X PUT \
  http://127.0.0.1:3001/participants/dfsp1 \
  -H 'Content-Type: application/json' \
  -H 'Postman-Token: 83ba45fa-12bb-4d63-b50f-a90dc2bfeb27' \
  -H 'cache-control: no-cache' \
  -d '{
	\"isActive\": false
}'"
echo
echo

echo "---------------------------------------------------------------------"
echo "Prepare transfer: 125ec534-ee48-4575-b6a9-ead2955b8101"
echo "---------------------------------------------------------------------"

echo "Sending request: dfsp1 -> dfsp2 :: 100 USD (dfsp1 as PAYER)"
sh -c "curl -X POST \
  http://127.0.0.1:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Thu, 28 Feb 2019 17:30:00 GMT' \
  -H 'FSPIOP-Destination: dfsp2' \
  -H 'FSPIOP-Source: dfsp1' \
  -H 'Postman-Token: c5efa6d9-4015-4db3-9952-19e4d542cb8a' \
  -H 'cache-control: no-cache' \
  -d '{
	\"transferId\": \"125ec534-ee48-4575-b6a9-ead2955b8101\",
	\"payerFsp\": \"dfsp1\",
	\"payeeFsp\": \"dfsp2\",
	\"amount\": {
		\"currency\": \"USD\",
		\"amount\": \"100\"
	},
	\"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
	\"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
	\"expiration\": \"2019-02-28T17:30:00.000+00:00\",
	\"extensionList\": {
		\"extension\": [{
			\"key\": \"prepare\",
			\"value\": \"Prepare description\"
		}]
	}
}'"
echo
echo

echo "---------------------------------------------------------------------"
echo "Prepare transfer: 125ec534-ee48-4575-b6a9-ead2955b8102"
echo "---------------------------------------------------------------------"

echo "Sending request: dfsp1 <- dfsp2 :: 100 USD (dfsp1 as PAYEE)"
sh -c "curl -X POST \
  http://127.0.0.1:3000/transfers \
  -H 'Accept: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Content-Type: application/vnd.interoperability.transfers+json;version=1.0' \
  -H 'Date: Thu, 28 Feb 2019 17:30:00 GMT' \
  -H 'FSPIOP-Destination: dfsp1' \
  -H 'FSPIOP-Source: dfsp2' \
  -H 'Postman-Token: c5efa6d9-4015-4db3-9952-19e4d542cb8a' \
  -H 'cache-control: no-cache' \
  -d '{
	\"transferId\": \"125ec534-ee48-4575-b6a9-ead2955b8102\",
	\"payerFsp\": \"dfsp2\",
	\"payeeFsp\": \"dfsp1\",
	\"amount\": {
		\"currency\": \"USD\",
		\"amount\": \"100\"
	},
	\"ilpPacket\": \"AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA\",
	\"condition\": \"bSqIkHNqib-I69QFoVR--ja3L4Raye2WERq2Gzitb-U\",
	\"expiration\": \"2019-02-28T17:30:00.000+00:00\",
	\"extensionList\": {
		\"extension\": [{
			\"key\": \"prepare\",
			\"value\": \"Prepare description\"
		}]
	}
}'"
echo
echo 
echo "Awaiting transfer prepares for $SLEEP_FACTOR_IN_SECONDS seconds..."
sleep $SLEEP_FACTOR_IN_SECONDS

echo
echo
echo "Completed Scenario 11-2 - Stop transfers at participant level"
echo

sh $CWD/21scenario-part2-results.sh
