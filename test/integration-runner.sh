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
    echo " - POSTGRES_PARTY: Posgres party"
    echo " - POSTGRES_PASSWORD: Posgres password"
    echo " - POSTGRES_HOST: Posgres host name"
    echo " - POSTGRES_PORT: Posgres container port"
    echo " - POSTGRES_DB: Posgres database"
    echo " - POSTGRES_IMAGE: Docker Image for Posgres"
    echo " - POSTGRES_TAG: Docker tag/version for Posgres"
    echo " - APP_HOST: Application host name"
    echo " - APP_DIR_TEST_RESULTS: Location of test results relative to the working directory"
    echo " - TEST_CMD: Interation test command to be executed"
    echo ""
    echo " * IMPORTANT: Ensure you have the required env in the test/integration-runner.env to execute the application"
    echo ""
    exit 1
fi
>&2 echo ""
>&2 echo "====== Loading environment variables ======"
cat $1
. $1
>&2 echo "==========================================="
>&2 echo ""

>&2 echo "Executing Integration Tests for $APP_HOST ..."

>&2 echo "Creating local directory to store test results"
mkdir -p test/results

fpsql() {
	docker run --rm -i \
		--entrypoint psql \
    --link $POSTGRES_HOST \
    -e PGPARTY=$POSTGRES_PARTY \
		-e PGPASSWORD=$POSTGRES_PASSWORD \
    -e PGDATABASE=$POSTGRES_DB \
    -e POSTGRES_DB=$POSTGRES_DBNAME \
		"$POSTGRES_IMAGE:$POSTGRES_TAG" \
    --host $POSTGRES_HOST \
		--username $POSTGRES_PARTY \
    --dbname $POSTGRES_DB \
		--quiet --no-align --tuples-only \
		"$@"
}

ftest() {
	docker run --rm -i \
    --link $POSTGRES_HOST \
    --env POSTGRES_PARTY="$POSTGRES_PARTY" \
    --env POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    --env POSTGRES_HOST="$POSTGRES_HOST" \
    --env POSTGRES_PORT="$POSTGRES_PORT" \
    --env POSTGRES_DB="$POSTGRES_DB" \
    --env CLEDG_DATABASE_URI="postgres://${POSTGRES_PARTY}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}" \
		"$DOCKER_IMAGE:$DOCKER_TAG" \
    /bin/sh \
    -c \
    "$@"
}

is_psql_up() {
    fpsql -c '\l' > /dev/null 2>&1
}

stop_docker() {
  >&2 echo "Posgres-int is shutting down $POSTGRES_HOST"
  (docker stop $POSTGRES_HOST && docker rm $POSTGRES_HOST) > /dev/null 2>&1
  >&2 echo "$APP_HOST environment is shutting down"
  (docker stop $APP_HOST && docker rm $APP_HOST) > /dev/null 2>&1
}

clean_docker() {
  stop_docker
  >&2 echo "Removing docker test image $DOCKER_IMAGE:$DOCKER_TAG"
  (docker rmi $DOCKER_IMAGE:$DOCKER_TAG) > /dev/null 2>&1
}

run_test_command()
{
  >&2 echo "Running $APP_HOST Test command: $TEST_CMD"
  docker run -i \
    --link $POSTGRES_HOST \
    --name $APP_HOST \
    --env POSTGRES_PARTY="$POSTGRES_PARTY" \
    --env POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    --env POSTGRES_HOST="$POSTGRES_HOST" \
    --env POSTGRES_PORT="$POSTGRES_PORT" \
    --env POSTGRES_DB="$POSTGRES_DB" \
		$DOCKER_IMAGE:$DOCKER_TAG \
    /bin/sh \
    -c "source test/.env; $TEST_CMD"
}

>&2 echo "Building Docker Image $DOCKER_IMAGE:$DOCKER_TAG with $DOCKER_FILE"
docker build --no-cache -t $DOCKER_IMAGE:$DOCKER_TAG -f $DOCKER_FILE .
#Docker build for local testing below
# docker build -t $DOCKER_IMAGE:$DOCKER_TAG -f $DOCKER_FILE .
echo "result "$?""
if [ "$?" != 0 ]
then
  >&2 echo "Build failed...exiting"
  clean_docker
  exit 1
fi

>&2 echo "Postgres is starting"
stop_docker
docker run --name $POSTGRES_HOST -d -p $POSTGRES_PORT:$POSTGRES_PORT -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_PARTY=$POSTGRES_PARTY -e POSTGRES_DB=$POSTGRES_DB "$POSTGRES_IMAGE:$POSTGRES_TAG" > /dev/null 2>&1

if [ "$?" != 0 ]
then
  >&2 echo "Starting Postgres failed...exiting"
  clean_docker
  exit 1
fi

until is_psql_up; do
  >&2 echo "Postgres is unavailable...sleeping"
  sleep 1
done

>&2 echo "Running migrations"
ftest "source test/.env; npm run migrate"

if [ "$?" != 0 ]
then
  >&2 echo "Migration failed...exiting"
  clean_docker
  exit 1
fi

>&2 echo "Integration tests are starting"
run_test_command
test_exit_code=$?

>&2 echo "Displaying test logs"
docker logs $APP_TEST_HOST

>&2 echo "Copy results to local directory"
docker cp $APP_HOST:$DOCKER_WORKING_DIR/$APP_DIR_TEST_RESULTS test

if [ "$test_exit_code" != 0 ]
then
  >&2 echo "Integration tests failed...exiting"
fi

clean_docker

exit "$test_exit_code"
