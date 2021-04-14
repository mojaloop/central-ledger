#!/bin/bash

>&2 echo "--==== Integration Tests Runner ====--"

if [ $# -ne 1 ]; then
    echo ""
    echo "Usage: $0 {env-file}"
    echo "{env-file} must contain the following variables:"
    echo " - DOCKER_IMAGE: Name of Image"
    echo " - DOCKER_TAG: Tag/Version of Image"
    echo " - DOCKER_FILE: Recipe to be used for Docker build"
    echo " - DOCKER_WORKING_DIR: Docker working directory"
    echo " - DB_USER: Database user"
    echo " - DB_PASSWORD: Database password"
    echo " - DB_HOST: Database host name"
    echo " - DB_PORT: Database container port"
    echo " - DB_NAME: Database database"
    echo " - DB_IMAGE: Docker Image for Database"
    echo " - DB_TAG: Docker tag/version for Database"
    echo " - KAFKA_IMAGE: Kafka image:tag"
    echo " - KAFKA_HOST: Kafka host"
    echo " - KAFKA_ZOO_PORT: Kafka host name"
    echo " - KAFKA_BROKER_PORT: Kafka container port"
    echo " - APP_HOST: Application host name"
    echo " - APP_PORT: Application port"
    echo " - APP_DIR_TEST_INTEGRATION: Location of the integration tests relative to the working directory"
    echo " - APP_DIR_TEST_RESULTS: Location of test results relative to the working directory"
    echo " - TEST_DIR: Base directory for tests"
    echo " - TEST_RESULTS_FILE: Name of integration test results xml file"
    echo " - TEST_CMD: Integration test command to be executed"
    echo ""
    echo " * IMPORTANT: Ensure you have the required env in the test/.env to execute the application"
    echo ""
    exit 1
fi
>&2 echo ""
>&2 echo "====== Loading environment variables ======"
cat $1
source $1
>&2 echo "==========================================="
>&2 echo ""

>&2 echo "Executing Integration Tests for $APP_HOST ..."

>&2 echo "Creating local directory to store test results"
mkdir -p $TEST_DIR/results

# Generic functions

stop_docker() {
  >&1 echo "Kafka is shutting down $KAFKA_HOST"
  (docker stop $KAFKA_HOST && docker rm $KAFKA_HOST) > /dev/null 2>&1
  >&1 echo "$DB_HOST environment is shutting down"
  (docker stop $DB_HOST && docker rm $DB_HOST) > /dev/null 2>&1
  >&1 echo "$APP_HOST environment is shutting down"
  (docker stop $APP_HOST && docker rm $APP_HOST) > /dev/null 2>&1
  >&1 echo "Deleting test network: $DOCKER_NETWORK"
  docker network rm integration-test-net
}

clean_docker() {
  stop_docker
}

ftest() {
  docker exec -it cl_central-ledger sh -c "$@"


  # docker run -i --rm \
  #   --link $KAFKA_HOST \
  #   --link $DB_HOST \
  #   --network $DOCKER_NETWORK \
  #   --env HOST_IP="$APP_HOST" \
  #   --env KAFKA_HOST="$KAFKA_HOST" \
  #   --env KAFKA_ZOO_PORT="$KAFKA_ZOO_PORT" \
  #   --env DB_HOST=$DB_HOST \
  #   --env DB_PORT=$DB_PORT \
  #   --env DB_USER=$DB_USER \
  #   --env DB_PASSWORD=$DB_PASSWORD \
  #   --env DB_NAME=$DB_NAME \
  #   --env TEST_DIR=$TEST_DIR \
  #   $DOCKER_IMAGE:$DOCKER_TAG \
  #   /bin/sh \
  #   -c "source $TEST_DIR/.env; $@"
}

fcurl() {
	docker run --rm -i \
		--link $ENDPOINT_HOST \
		--network $DOCKER_NETWORK \
		--entrypoint curl \
		"jlekie/curl:latest" \
        --silent --head --fail \
		"$@"
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

# DB functions

start_db() {
  docker run -td \
    -p $DB_PORT:$DB_PORT \
    --name $DB_HOST \
    --network $DOCKER_NETWORK \
    -e MYSQL_USER=$DB_USER \
    -e MYSQL_PASSWORD=$DB_PASSWORD \
    -e MYSQL_DATABASE=$DB_NAME \
    -e MYSQL_ALLOW_EMPTY_PASSWORD=true \
    $DB_IMAGE:$DB_TAG
}

fdb() {
  docker exec -it cl_mysql sh -c "$@"
}

is_db_up() {
  fdb "mysql -P$DB_PORT -u$DB_USER -p$DB_PASSWORD -e 'select 1'" > /dev/null 2>&1
}

# Script execution
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

# clean_docker
>&1 echo "Integration tests exited with code: $test_exit_code"
exit "$test_exit_code"
