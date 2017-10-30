#!/bin/bash
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
LEDGER_HOST=${HOST_IP:-localhost}
export CLEDG_HOSTNAME='http://localhost:3000'
export CLEDG_EXPIRES_TIMEOUT=5000
export API_IMAGE=${API_IMAGE:-'central-ledger'}
export ADMIN_IMAGE=${ADMIN_IMAGE:-'central-ledger-admin'}
TEST_CMD='node test/spec/index.js'
docker_compose_file='docker-compose.yml'
docker_functional_compose_file='docker-compose.functional.yml'
env_file='.env'

psql() {
	docker run --rm -i \
		--net centralledger_back \
		--entrypoint psql \
		-e PGPASSWORD=$POSTGRES_PASSWORD \
		"postgres:9.4" \
    --host postgres \
		--username $POSTGRES_USER \
    --dbname postgres \
		--quiet --no-align --tuples-only \
		"$@"
}

is_psql_up() {
    psql -c '\l' > /dev/null 2>&1
}

is_api_up() {
    curl --output /dev/null --silent --head --fail http://${LEDGER_HOST}:3000/health
}

is_admin_up() {
    curl --output /dev/null --silent --head --fail http://${LEDGER_HOST}:3001/health
}

run_test_command()
{
  eval "$TEST_CMD"
}

shutdown_and_remove() {
  docker-compose -f $docker_compose_file -f $docker_functional_compose_file stop
}

>&2 echo "Loading environment variables"
source $env_file

>&2 echo "Postgres is starting"
docker-compose -f $docker_compose_file -f $docker_functional_compose_file up -d postgres

until is_psql_up; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - creating functional database"
psql <<'EOSQL'
    DROP DATABASE IF EXISTS "central_ledger_functional";
	  CREATE DATABASE "central_ledger_functional";
EOSQL

>&2 printf "Central-ledger is building ..."
docker-compose -f $docker_compose_file -f $docker_functional_compose_file up -d central-ledger

>&2 printf "Central-ledger is starting ..."
until is_api_up; do
  >&2 printf "."
  sleep 5
done

>&2 echo " done"


>&2 echo "Spec tests are starting"
set -o pipefail && run_test_command
test_exit_code=$?

if [ "$test_exit_code" != 0 ]
then
  docker logs centralledger_central-ledger_1
fi

shutdown_and_remove

exit "$test_exit_code"
