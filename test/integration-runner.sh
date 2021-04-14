#!/bin/bash

>&2 echo "--==== Integration Tests Runner ====--"
>&2 echo "====== Loading environment variables ======"
cat $1
source $1
>&2 echo "==========================================="
>&2 echo ""

>&2 echo "Executing Integration Tests for $APP_HOST ..."

>&2 echo "Creating local directory to store test results"
mkdir -p $TEST_DIR/results

# Helper functions

ftest() {
  docker exec -it cl_central-ledger sh -c "$@"
}

fkafka() {
  >&2 echo "fkafka()"
	docker run --rm -i \
	  --link $KAFKA_HOST \
	  --network $DOCKER_NETWORK \
	  --env KAFKA_HOST="$KAFKA_HOST" \
    --env KAFKA_ZOO_PORT="$KAFKA_ZOO_PORT" \
	  taion809/kafka-cli \
	  /bin/sh \
	  -c \
		"$@"
}

is_kafka_up() {
  fkafka 'kafka-topics.sh --list --zookeeper $KAFKA_HOST:$KAFKA_ZOO_PORT' > /dev/null 2>&1
}

fdb() {
  docker exec -it cl_mysql sh -c "$@"
}

is_db_up() {
  fdb "mysql -P$DB_PORT -u$DB_USER -p$DB_PASSWORD -e 'select 1'" > /dev/null 2>&1
}

# Integration Test Execution

if [ ${INTEGRATION_TEST_REPEAT_MODE} = "true" ]; then
  echo 'INTEGRATION_TEST_REPEAT_MODE set, stopping containers and clearing mysql state'
  docker-compose stop
  docker-compose rm -f mysql
else 
  echo 'INTEGRATION_TEST_REPEAT_MODE not set, building containers from scratch'
  docker-compose -f docker-compose.yml -f docker-compose.integration.yml build
fi 

docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d kafka mysql objstore central-ledger
docker-compose ps

echo "Waiting for MySQL"
until is_db_up; do
  >&2 printf "."
  sleep 5
done


>&1 echo "Running migrations"
ftest "npm run migrate"

echo "Integration tests are starting"
ftest "npm run test:int"
test_exit_code=$?
echo "Test exited with result code.... $test_exit_code ..."

>&1 echo "Displaying test logs"
docker logs $APP_HOST

>&1 echo "Copy results to local directory"
docker cp $APP_HOST:$DOCKER_WORKING_DIR/$APP_DIR_TEST_RESULTS $TEST_DIR

if [ "$test_exit_code" = "0" ]
then
  >&1 echo "Showing results..."
  cat $APP_DIR_TEST_RESULTS/$TEST_RESULTS_FILE
else
  >&2 echo "Integration tests failed...exiting"
  >&2 echo "Test environment logs..."
  docker logs $APP_HOST
fi

>&1 echo "Integration tests exited with code: $test_exit_code"
exit "$test_exit_code"
