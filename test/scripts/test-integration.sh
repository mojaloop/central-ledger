#!/bin/bash

echo "--=== Running Integration Test Runner ===--"
echo

MYSQL_VERSION=${MYSQL_VERSION:-"latest"}
KAFKA_VERSION=${MYSQL_VERSION:-"latest"}
INT_TEST_SKIP_SHUTDOWN=${INT_TEST_SKIP_SHUTDOWN:-false}

echo "==> Variables:"
echo "====> MYSQL_VERSION=$MYSQL_VERSION"
echo "====> KAFKA_VERSION=$KAFKA_VERSION"
echo "====> INT_TEST_SKIP_SHUTDOWN=$INT_TEST_SKIP_SHUTDOWN"

## Set initial exit code value to 1 (i.e. assume error!)
TTK_FUNC_TEST_EXIT_CODE=1

## Make reports directory
mkdir ./test/results

## Start backend services
echo "==> Starting Docker backend services"
docker compose pull mysql kafka init-kafka
docker compose up -d mysql kafka init-kafka
docker compose ps
npm run wait-4-docker

# Migrate
npm run migrate
npm start > ./test/results/cl-service.log &

## Store PID for cleanup
echo $! > /tmp/int-test-service.pid
PID=$(cat /tmp/int-test-service.pid)
echo "Service started with Process ID=$PID"

## Check Service Health
echo "Waiting for Service to be healthy"
bash .circleci/curl-retry-cl-health.sh

## Lets wait a few seconds to ensure that Kafka handlers are rebalanced
echo "Waiting ${WAIT_FOR_REBALANCE}s for Kafka Re-balancing..." && sleep $WAIT_FOR_REBALANCE

## Start integration tests
echo "Running Integration Tests"
INTEGRATION_TEST_EXIT_CODE="$?"
npm run test:xint
echo "==> integration tests exited with code: $INTEGRATION_TEST_EXIT_CODE"

## Kill service
echo "Stopping Service with Process ID=$PID"
kill $(cat /tmp/int-test-service.pid)
kill $(lsof -t -i:3001)

## Restart service with topic name override
echo "Starting Service in the background"
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT='topic-transfer-position-batch'
npm start > ./test/results/cl-service-override.log &
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT

## Store PID for cleanup
echo $! > /tmp/int-test-service.pid
PID=$(cat /tmp/int-test-service.pid)
echo "Service started with Process ID=$PID"

## Check Service Health
echo "Waiting for Service to be healthy"
bash .circleci/curl-retry-cl-health.sh

## Lets wait a few seconds to ensure that Kafka handlers are rebalanced
echo "Waiting ${WAIT_FOR_REBALANCE}s for Kafka Re-balancing..." && sleep $WAIT_FOR_REBALANCE

## Start integration tests
echo "Running Override Integration Tests"
OVERRIDE_INTEGRATION_TEST_EXIT_CODE="$?"
npm run test:xint-override
echo "==> override integration tests exited with code: $OVERRIDE_INTEGRATION_TEST_EXIT_CODE"

## Kill service
echo "Stopping Service with Process ID=$PID"
kill $(cat /tmp/int-test-service.pid)
kill $(lsof -t -i:3001)

## Shutdown the backend services
if [ $INT_TEST_SKIP_SHUTDOWN == true ]; then
  echo "==> Skipping test harness shutdown"
else
  echo "==> Shutting down test harness"
  docker compose down -v
fi

## Exit with the exit code from the test harness
INT_TEST_EXIT_CODE=$((INTEGRATION_TEST_EXIT_CODE && OVERRIDE_INTEGRATION_TEST_EXIT_CODE))
echo "==> Exiting functional tests with code: $INT_TEST_EXIT_CODE"
exit $INT_TEST_EXIT_CODE
