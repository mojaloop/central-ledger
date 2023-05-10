# central-ledger

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/central-ledger.svg?style=flat)](https://github.com/mojaloop/central-ledger/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/central-ledger.svg?style=flat)](https://github.com/mojaloop/central-ledger/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/central-ledger.svg?style=flat)](https://hub.docker.com/r/mojaloop/central-ledger)
[![Npm Version](https://img.shields.io/npm/v/@mojaloop/central-ledger.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/central-ledger)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@mojaloop/central-ledger.svg?style=flat)](https://www.npmjs.com/package/@mojaloop/central-ledger)
[![CircleCI](https://circleci.com/gh/mojaloop/central-ledger.svg?style=svg)](https://app.circleci.com/pipelines/github/mojaloop/central-ledger)

The central ledger is a series of services that facilitate clearing and settlement of transfers between DFSPs, including the following functions:

- Brokering real-time messaging for funds clearing
- Maintaining net positions for a deferred net settlement
- Propagating scheme-level and off-transfer fees

The following documentation represents the services, APIs and endpoints responsible for various ledger functions.

## Contents

- [central-ledger](#central-ledger)
  - [Contents](#contents)
  - [Running Locally](#running-locally)
  - [Configuration](#configuration)
    - [Environment variables](#environment-variables)
  - [API](#api)
  - [Logging](#logging)
  - [Tests](#tests)
    - [Running Integration Tests interactively](#running-integration-tests-interactively)
  - [Development environment](#development-environment)
  - [Auditing Dependencies](#auditing-dependencies)
  - [Container Scans](#container-scans)
  - [Automated Releases](#automated-releases)
    - [Potential problems](#potential-problems)

## Running Locally

Please follow the instruction in [Onboarding Document](Onboarding.md) to setup and run the service locally.

## Configuration

### Environment variables

The Central Ledger has many options that can be configured through environment variables.

| Environment variable | Description | Example values |
| -------------------- | ----------- | ------ |
| CLEDG\_DATABASE_URI   | The connection string for the database the central ledger will use. Postgres is currently the only supported database. | postgres://\<username>:\<password>@localhost:5432/central_ledger |
| CLEDG\_PORT | The port the API server will run on. | 3000 |
| CLEDG\_ADMIN_PORT | The port the Admin server will run on. | 3001 |
| CLEDG\_HOSTNAME | The URI that will be used to create and validate links to resources on the central ledger.  | <http://central-ledger> |
| CLEDG\_ENABLE\_BASIC_AUTH | Flag to enable basic auth protection on endpoints that require authorization. Username and password would be the account name and password. | false |
| CLEDG\_ENABLE\_TOKEN_AUTH | Flag to enable token protection on endpoints that require authorization. To create a token, reference the [API documentation](API.md). | false |
| CLEDG\_LEDGER\_ACCOUNT_NAME | Name of the account setup to receive fees owed to the central ledger. If the account doesn't exist, it will be created on start up. | LedgerName |
| CLEDG\_LEDGER\_ACCOUNT_PASSWORD | Password of the account setup to receive fees owed to the central ledger.  | LedgerPassword |
| CLEDG\_ADMIN_KEY | Key used for admin access to endpoints that require validation. | AdminKey |
| CLEDG\_ADMIN_SECRET | Secret used for admin access to endpoints that require validation. Secret also used to sign JWTs used for Admin API. | AdminSecret |
| CLEDG\_TOKEN_EXPIRATION | Time in milliseconds for Admin API tokens to expire. | 3600000 |
| CLEDG\_EXPIRES_TIMEOUT | Time in milliseconds to determine how often transfer expiration process runs. | 5000 |
| CLEDG\_AMOUNT__PRECISION | Numeric value used to determine precision recorded for transfer amounts on this ledger. | 10 |
| CLEDG\_AMOUNT__SCALE | Numeric value used to determine scale recorded for transfer amounts on this ledger. | 2 |

## API

For endpoint documentation, see the [API documentation](API.md).

For help preparing and executing transfers, see the [Transfer Guide](TransferGuide.md)

## Logging

Logs are sent to standard output by default.

## Tests

Tests include unit, functional, and integration.

Running the tests:

```bash
npm run test:all
```

Tests include code coverage via istanbul. See the test/ folder for testing scripts.

### Running Integration Tests interactively

If you want to run integration tests in a repetitive manner, you can start-up the test containers using `docker-compose` via one of the following methods:

- Running locally

    Start containers required for Integration Tests

    ```bash
    docker-compose -f docker-compose.yml up -d kafka mysql
    ```

    Run wait script which will report once all required containers are up and running

    ```bash
    npm run wait-4-docker
    ```

    Start the Central-Ledger Service in the background, capturing the Process ID, so we can kill it when we are done. Alternatively you could also start the process in a separate terminal. This is a temporary work-around until the following issue can be addressed: https://github.com/mojaloop/project/issues/3112.

    ```bash
    npm start > cl-service.log &
    echo $! > /tmp/int-test-service.pid
    ```

    You can access the Central-Ledger Service log in another terminal with `tail -f cl-service.log`.

    Run the Integration Tests

    ```bash
    npm run test:int
    ```

    Kill the background Central-Ledger Service

    ```bash
    kill $(cat /tmp/int-test-service.pid)
    ```

- Running inside docker

    Start containers required for Integration Tests, including a `central-ledger` container which will be used as a proxy shell.

    ```bash
    docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d kafka mysql central-ledger
    ```

    Run the Integration Tests from the `central-ledger` container

    ```bash
    docker exec -it cl_central-ledger sh
    export CL_DATABASE_HOST=mysql
    npm run test:int
  ```

- Removing the CL Image
```shell
docker rmi central-ledger_central-ledger
```

### Running Functional Tests

If you want to run functional tests locally utilizing the [ml-core-test-harness](https://github.com/mojaloop/ml-core-test-harness), you can run the following commands:

  ```bash
  git clone --depth 1 --branch v0.0.2 https://github.com/mojaloop/ml-core-test-harness.git ./IGNORE/ml-core-test-harness
  ```

  ```bash
  docker build -t mojaloop/central-ledger:local .
  ```

  ```bash
  cd IGNORE/ml-core-test-harness
  export CENTRAL_LEDGER_VERSION=local
  docker-compose --project-name ttk-func --ansi never --profile all-services --profile ttk-provisioning --profile ttk-tests up -d
  ```

  Check test container logs for test results

  Or access TTK UI using the following URI: <http://localhost:9660>

  TTK Test files:
      - Test Collection: ./IGNORE/ml-core-test-harness/docker/ml-testing-toolkit/test-cases/collections/tests/p2p.json
      - Env Config: ./IGNORE/ml-core-test-harness/docker/ml-testing-toolkit/test-cases/environments/default-env.json

## Development environment

  Start Docker dependant Services

  ```bash
  docker compose -f ./docker-compose.yml -f docker-compose.dev.yml up -d
  ```

  Start local Central-Ledger Service

  ```bash
  npm start
  ```

  Populate Test Data

  ```bash
  sh ./test/util/scripts/populateTestData.sh
  ```
  
  View Logs for Mockserver (i.e. Payee Receiver) and ML-API-Adapter:

  ```bash
  docker logs -f mockserver
  docker logs -f cl_ml-api-adapter
  ```

  Postman Test Collection: [./test/util/postman/CL-Local Docker Test.postman_collection.json](./test/util/postman/CL-Local%20Docker%20Test.postman_collection.json)

## Auditing Dependencies

We use `npm-audit-resolver` along with `npm audit` to check dependencies for node vulnerabilities, and keep track of resolved dependencies with an `audit-resolve.json` file.

To start a new resolution process, run:

```bash
npm run audit:resolve
```

You can then check to see if the CI will pass based on the current dependencies with:

```bash
npm run audit:check
```

And commit the changed `audit-resolve.json` to ensure that CircleCI will build correctly.

## Container Scans

As part of our CI/CD process, we use anchore-cli to scan our built docker container for vulnerabilities upon release.

If you find your release builds are failing, refer to the [container scanning](https://github.com/mojaloop/ci-config#container-scanning) in our shared Mojaloop CI config repo. There is a good chance you simply need to update the `mojaloop-policy-generator.js` file and re-run the circleci workflow.

For more information on anchore and anchore-cli, refer to:
    - [Anchore CLI](https://github.com/anchore/anchore-cli)
    - [Circle Orb Registry](https://circleci.com/orbs/registry/orb/anchore/anchore-engine)

## Automated Releases

As part of our CI/CD process, we use a combination of CircleCI, standard-version
npm package and github-release CircleCI orb to automatically trigger our releases
and image builds. This process essentially mimics a manual tag and release.

On a merge to master, CircleCI is configured to use the mojaloopci github account
to push the latest generated CHANGELOG and package version number.

Once those changes are pushed, CircleCI will pull the updated master, tag and
push a release triggering another subsequent build that also publishes a docker image.

### Potential problems

- There is a case where the merge to master workflow will resolve successfully, triggering
  a release. Then that tagged release workflow subsequently failing due to the image scan,
  audit check, vulnerability check or other "live" checks.

  This will leave master without an associated published build. Fixes that require
  a new merge will essentially cause a skip in version number or require a clean up
  of the master branch to the commit before the CHANGELOG and bump.

  This may be resolved by relying solely on the previous checks of the
  merge to master workflow to assume that our tagged release is of sound quality.
  We are still mulling over this solution since catching bugs/vulnerabilities/etc earlier
  is a boon.

- It is unknown if a race condition might occur with multiple merges with master in
  quick succession, but this is a suspected edge case.
