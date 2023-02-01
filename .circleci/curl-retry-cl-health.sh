#!/bin/bash

url="http://localhost:3001/health"

# Number of retries
retries=10

# Sleep between retries
sleepwait=1

# Counter for retries
count=0

while [ $count -lt $retries ]
do
  response=$(curl -s -o /dev/null -w "%{http_code}" $url)
  if [ $response -eq 200 ]; then
    echo "Successful response: $response"
    break
  else
    echo "Response: $response. Retrying..."
    ((count++))
    sleep $sleepwait
  fi
done

if [ $count -eq $retries ]; then
  echo "Failed after $retries attempts."
  exit 1
fi
