#!/bin/bash
export API_IMAGE=${API_IMAGE:-'central-ledger'}
export POSTGRES_USER=${POSTGRES_USER:-"postgres"}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"postgres"}
export CENRRALLEDGER_TEST_HOST=${HOST_IP:-"centralledger-int"}
export POSTGRES_HOST=${HOST_IP:-"postgres-int"}
env_file=$1
INTG_TEST_CMD=${INTG_TEST_CMD:-"source $env_file; tape 'test/integration/**/*.test.js' | tap-xunit > ./test/results/tape-integration.xml; cat ./test/results/tape-integration.xml"}
# INTG_TEST_CMD=${INTG_TEST_CMD:-"tape 'test/integration/**/*.test.js'"}


#create a directory for test results
mkdir -p ./test/results

if [ $# -ne 1 ]; then
    echo "Usage: $0 env-file"
    exit 1
fi

fpsql() {
	docker run --rm -i \
		--entrypoint psql \
    --link $POSTGRES_HOST \
		-e PGPASSWORD=$POSTGRES_PASSWORD \
		"postgres:9.4" \
    --host $POSTGRES_HOST \
		--username $POSTGRES_USER \
    --dbname postgres \
		--quiet --no-align --tuples-only \
		"$@"
}

ftest() {
	docker run --rm -i \
    --link $POSTGRES_HOST \
    --env CLEDG_DATABASE_URI="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/central_ledger_integration" \
		$API_IMAGE:test \
    /bin/sh \
    -c \
    "$@"
}

is_psql_up() {
    fpsql -c '\l' > /dev/null 2>&1
}

stop_docker() {
  >&2 echo "Posgres-int is shutting down"
  (docker stop $POSTGRES_HOST && docker rm $POSTGRES_HOST) > /dev/null 2>&1
  >&2 echo "Central Ledger Test environment is shutting down"
  (docker stop $CENRRALLEDGER_TEST_HOST && docker rm $CENRRALLEDGER_TEST_HOST) > /dev/null 2>&1
}

run_test_command()
{
  >&2 echo "Running Central Ledger Test command: $INTG_TEST_CMD"
  docker run -i \
    --link $POSTGRES_HOST \
    --name $CENRRALLEDGER_TEST_HOST \
    --env CLEDG_DATABASE_URI="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/central_ledger_integration" \
		$API_IMAGE:test \
    /bin/sh \
    -c "$INTG_TEST_CMD"
}

>&2 echo "Loading environment variables"
. $env_file

>&2 echo "Postgres is starting"
stop_docker
docker run --name $POSTGRES_HOST -d -p 15432:5432 -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_USER=$POSTGRES_USER "postgres:9.4" > /dev/null 2>&1

until is_psql_up; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - creating integration database"
fpsql <<'EOSQL'
    DROP DATABASE IF EXISTS "central_ledger_integration";
	  CREATE DATABASE "central_ledger_integration";
EOSQL

>&2 echo "Running migrations"
ftest "npm run migrate > /dev/null 2>&1"

>&2 echo "Integration tests are starting"
run_test_command
test_exit_code=$?

if [ "$test_exit_code" != 0 ]
then
  >&2 echo "Test environment logs..."
  docker logs $CENRRALLEDGER_TEST_HOST
fi

>&2 echo "Copy results to local directory"
docker cp $CENRRALLEDGER_TEST_HOST:/opt/central-ledger/test/results ./test

stop_docker

exit "$test_exit_code"
