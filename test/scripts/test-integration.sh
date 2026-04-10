#!/bin/bash

echo "--=== Running Integration Test Runner ===--"
echo

MYSQL_VERSION=${MYSQL_VERSION:-"latest"}
KAFKA_VERSION=${MYSQL_VERSION:-"latest"}
INT_TEST_SKIP_SHUTDOWN=${INT_TEST_SKIP_SHUTDOWN:-false}
LOG_LEVEL=${LOG_LEVEL:-"info"}
# Callback URLs use 'simulator' hostname. ml-api-adapter has extra_hosts mapping
# 'simulator:host-gateway' so it can reach the simulator container on the host.
export SIMULATOR_REMOTE_HOST=${SIMULATOR_REMOTE_HOST:-simulator}

echo "==> Variables:"
echo "====> MYSQL_VERSION=$MYSQL_VERSION"
echo "====> KAFKA_VERSION=$KAFKA_VERSION"
echo "====> INT_TEST_SKIP_SHUTDOWN=$INT_TEST_SKIP_SHUTDOWN"
echo "====> LOG_LEVEL=$LOG_LEVEL"
echo "====> SIMULATOR_REMOTE_HOST=$SIMULATOR_REMOTE_HOST"

## Set initial exit code value to 1 (i.e. assume error!)
TTK_FUNC_TEST_EXIT_CODE=1

## Make reports directory
mkdir ./test/results

## Start backend services
echo "==> Starting Docker backend services"
docker compose up -d --quiet-pull mysql kafka init-kafka redis-node-0 redis-node-1 redis-node-2 redis-node-3 \
  redis-node-4 redis-node-5 ml-api-adapter simulator
docker compose ps
npm run wait-4-docker

## Capture docker container logs in background
docker logs -f cl_ml-api-adapter > ./test/results/ml-api-adapter.log 2>&1 &
docker logs -f cl_simulator > ./test/results/simulator.log 2>&1 &

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

## Wait for Kafka consumer groups to have partition assignments
echo "Checking Kafka consumer group status..."
./test/scripts/wait-for-kafka-consumers.js

## Start integration tests
echo "Running Integration Tests"
LOG_LEVEL=${LOG_LEVEL} npm run test:xint
INTEGRATION_TEST_EXIT_CODE="$?"
echo "==> integration tests exited with code: $INTEGRATION_TEST_EXIT_CODE"

## Kill service gracefully, then force if needed
echo "Stopping Service with Process ID=$PID"
if [ -f /tmp/int-test-service.pid ]; then
  kill $(cat /tmp/int-test-service.pid) 2>/dev/null || true
  sleep 3
  kill -9 $(cat /tmp/int-test-service.pid) 2>/dev/null || true
fi
# Force kill anything on port 3001 as fallback
kill -9 $(lsof -t -i:3001) 2>/dev/null || true

## Give some time before restarting service for override tests
sleep 5

## Restart service with topic name override
echo "Starting Service in the background"
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__RESERVE='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__TIMEOUT_RESERVED='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_TIMEOUT_RESERVED='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__ABORT='topic-transfer-position-batch'
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_ABORT='topic-transfer-position-batch'

npm start > ./test/results/cl-service-override.log &
## Store PID for cleanup
echo $! > /tmp/int-test-service.pid
env "CLEDG_HANDLERS__API__DISABLED=true" node src/handlers/index.js handler --positionbatch > ./test/results/cl-batch-handler.log &
## Store PID for cleanup
echo $! > /tmp/int-test-handler.pid
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__RESERVE
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__TIMEOUT_RESERVED
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_TIMEOUT_RESERVED
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__ABORT
unset CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_ABORT

PID1=$(cat /tmp/int-test-service.pid)
echo "Service started with Process ID=$PID1"

PID2=$(cat /tmp/int-test-handler.pid)
echo "Service started with Process ID=$PID2"

## Check Service Health
echo "Waiting for Service to be healthy"
bash .circleci/curl-retry-cl-health.sh

echo "Checking Kafka consumer group status..."
./test/scripts/wait-for-kafka-consumers.js

## Start integration tests
echo "Running Override Integration Tests"

LOG_LEVEL=${LOG_LEVEL} npm run test:xint-override
OVERRIDE_INTEGRATION_TEST_EXIT_CODE="$?"
echo "==> override integration tests exited with code: $OVERRIDE_INTEGRATION_TEST_EXIT_CODE"

## Kill services gracefully, then force if needed
echo "Stopping Service with Process ID=$PID1"
if [ -f /tmp/int-test-service.pid ]; then
  kill $(cat /tmp/int-test-service.pid) 2>/dev/null || true
  sleep 3
  kill -9 $(cat /tmp/int-test-service.pid) 2>/dev/null || true
fi
# Force kill anything on port 3001 as fallback
kill -9 $(lsof -t -i:3001) 2>/dev/null || true

echo "Stopping Service with Process ID=$PID2"
if [ -f /tmp/int-test-handler.pid ]; then
  kill $(cat /tmp/int-test-handler.pid) 2>/dev/null || true
  sleep 3
  kill -9 $(cat /tmp/int-test-handler.pid) 2>/dev/null || true
fi

## Shutdown the backend services
if [ $INT_TEST_SKIP_SHUTDOWN == true ]; then
  echo "==> Skipping test harness shutdown"
else
  echo "==> Shutting down test harness"
  docker compose down -v
fi

## Exit with the exit code from the test harness
INT_TEST_EXIT_CODE=$((INTEGRATION_TEST_EXIT_CODE || OVERRIDE_INTEGRATION_TEST_EXIT_CODE))
echo "==> Exiting integration tests with code: $INT_TEST_EXIT_CODE"
exit $INT_TEST_EXIT_CODE
