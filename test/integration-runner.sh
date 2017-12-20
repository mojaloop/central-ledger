#!/bin/bash
export POSTGRES_USER=${POSTGRES_USER:-"postgres"}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"postgres"}
export POSTGRES_HOST=${HOST_IP:-"localhost"}
INTG_TEST_CMD=${INTG_TEST_CMD:-"tape 'test/integration/**/*.test.js' | tap-xunit > ./test/results/tape-integration.xml"}
env_file=$1

#create a directory for test results
mkdir ./test/results

if [ $# -ne 1 ]; then
    echo "Usage: $0 env-file"
    exit 1
fi

fpsql() {
	docker run --rm -i \
		--entrypoint psql \
    --link postgres-int \
		-e PGPASSWORD=$POSTGRES_PASSWORD \
		"postgres:9.4" \
    --host postgres-int \
		--username $POSTGRES_USER \
    --dbname postgres \
		--quiet --no-align --tuples-only \
		"$@"
}

is_psql_up() {
    fpsql -c '\l' > /dev/null 2>&1
}

stop_docker() {
  (docker stop postgres-int && docker rm postgres-int) > /dev/null 2>&1
}

run_test_command()
{
  eval "$INTG_TEST_CMD"
}

>&2 echo "Loading environment variables"
source $env_file

>&2 echo "Postgres is starting"
stop_docker
docker run --name postgres-int -d -p 15432:5432 -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_USER=$POSTGRES_USER "postgres:9.4" > /dev/null 2>&1

until is_psql_up; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - creating integration database"
fpsql <<'EOSQL'
    DROP DATABASE IF EXISTS "central_ledger_integration";
	  CREATE DATABASE "central_ledger_integration";
EOSQL

export CLEDG_DATABASE_URI="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:15432/central_ledger_integration"

>&2 echo "Running migrations"
npm run migrate > /dev/null 2>&1

>&2 echo "Integration tests are starting"
run_test_command
