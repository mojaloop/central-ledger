# central-ledger

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/central-ledger.svg?style=flat)](https://github.com/mojaloop/central-ledger/commits/main)
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

## Docker Image

### Official Packaged Release

This package is available as a pre-built docker image on Docker Hub: [https://hub.docker.com/r/mojaloop/central-ledger](https://hub.docker.com/r/mojaloop/central-ledger)

### Build from Source

You can also build it directly from source: [https://github.com/mojaloop/central-ledger](hhttps://github.com/mojaloop/central-ledger)

However, take note of the default argument in the [Dockerfile](./Dockerfile) for `NODE_VERSION`:

```dockerfile
ARG NODE_VERSION=lts-alpine
```

It is recommend that you set the `NODE_VERSION` argument against the version set in the local [.nvmrc](./.nvmrc).

This can be done using the following command: `npm run docker:build`

Or via docker build directly:

```bash
docker build \
  --build-arg NODE_VERSION="$(cat .nvmrc)-alpine3.19" \
  -t mojaloop/ml-api-adapter:local \
  .
```

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

### Kafka Position Event Type Action Topic Map

In some cases, you might want to publish position type messages onto a customized topic name that
diverges from the defaults.

You can configure the customized topic names in the config. Each position action key
refers to position messages with associated actions.

NOTE: Only POSITION.PREPARE and POSITION.COMMIT is supported at this time, with additional event-type-actions being added later when required.

```
  "KAFKA": {
    "EVENT_TYPE_ACTION_TOPIC_MAP" : {
      "POSITION":{
        "PREPARE": "topic-transfer-position-batch",
        "COMMIT": "topic-transfer-position-batch"
      }
    }
  }
```

### Batch Processing Configuration Guide

Batch processing can be enabled in the transfer execution flow. Follow the steps below to enable batch processing for a more efficient transfer execution:

Note: The position messages with action 'FX_PREPARE', 'FX_COMMIT' and 'FX_TIMEOUT_RESERVED' are only supported in batch processing.

- **Step 1:** **Create a New Kafka Topic**

  Create a new Kafka topic named `topic-transfer-position-batch` to handle batch processing events.
- **Step 2:** **Configure Action Type Mapping**

  Point the prepare handler to the newly created topic for the action types that are supported in batch processing using the `KAFKA.EVENT_TYPE_ACTION_TOPIC_MAP` configuration as shown below:
  ```
    "KAFKA": {
      "EVENT_TYPE_ACTION_TOPIC_MAP" : {
        "POSITION":{
          "PREPARE": "topic-transfer-position-batch",
          "BULK_PREPARE": "topic-transfer-position",
          "COMMIT": "topic-transfer-position-batch",
          "FX_COMMIT": "topic-transfer-position-batch",
          "BULK_COMMIT": "topic-transfer-position",
          "RESERVE": "topic-transfer-position",
          "FX_PREPARE": "topic-transfer-position-batch",
          "TIMEOUT_RESERVED": "topic-transfer-position-batch",
          "FX_TIMEOUT_RESERVED": "topic-transfer-position-batch"
        }
      }
    }
  ```
  _NOTE_: `BULK_PREPARE` configuration property is added to aid routing of `bulk-prepare` events to non-batch handler since the batch handler does not support `bulk-prepare` events.

- **Step 3:** **Run Batch Processing Handlers**

  Run the position batch handler along with the existing position handler using the following configuration options:
  - **Configure Event Type Action Topic Map for Batch Handler:**

      Configure the `EVENT_TYPE_ACTION_TOPIC_MAP` parameter for the position batch handler to consume events from the new topic (topic-transfer-position-batch).

  - **Set Batch Size:**

      Adjust the batch size using the parameter `KAFKA.CONSUMER.TRANSFER.POSITION_BATCH.config.options.batchSize`. This parameter determines the number of messages fetched in each batch.

  - **Set Consume Timeout:**

      Configure the consume timeout using the parameter `KAFKA.CONSUMER.TRANSFER.POSITION_BATCH.config.options.consumeTimeout`. This parameter specifies the number of milliseconds to wait for a batch of messages to be fetched if the specified batch size of messages is not immediately available.

Example Command to Run Handlers:
```
node src/handlers/index.js handler --positionbatch
```

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

If you want to run integration tests in a repetitive manner, you can startup the test containers using `docker-compose` via one of the following methods:

- Running locally

    Start containers required for Integration Tests

    ```bash
    docker compose up -d mysql kafka init-kafka redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5
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
    docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d kafka mysql central-ledger init-kafka redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5
    ```

    Run the Integration Tests from the `central-ledger` container

    ```bash
    docker exec -it cl_central-ledger sh
    export CL_DATABASE_HOST=mysql
    npm run test:int
  ```

If you want to run override position topic tests you can repeat the above and use `npm run test:int-override` after configuring settings found [here](#kafka-position-event-type-action-topic-map)

#### For running integration tests for batch processing interactively
- Run dependecies
```bash
docker compose up -d mysql kafka init-kafka redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5
npm run wait-4-docker
```
- Run central-ledger services
```
nvm use
npm run migrate
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__RESERVE=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__TIMEOUT_RESERVED=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_TIMEOUT_RESERVED=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__ABORT=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_ABORT=topic-transfer-position-batch
npm start
```
- Additionally, run position batch handler in a new terminal
```
nvm use
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__PREPARE=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_PREPARE=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__COMMIT=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__TIMEOUT_RESERVED=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_TIMEOUT_RESERVED=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__ABORT=topic-transfer-position-batch
export CLEDG_KAFKA__EVENT_TYPE_ACTION_TOPIC_MAP__POSITION__FX_ABORT=topic-transfer-position-batch
export CLEDG_HANDLERS__API__DISABLED=true
node src/handlers/index.js handler --positionbatch
```
- Run tests using the following commands in a new terminal
```
nvm use
npm run test:int-override
```


If you want to just run all of the integration suite non-interactively then use npm run `test:integration`.
It will handle docker start up, migration, service starting and testing. Be sure to exit any previously ran handlers or docker commands.

### Running Functional Tests

If you want to run functional tests locally utilizing the [ml-core-test-harness](https://github.com/mojaloop/ml-core-test-harness), you can run the following commands:

```bash
export NODE_VERSION="$(cat .nvmrc)-alpine"
docker build \
  --build-arg NODE_VERSION=$NODE_VERSION \
  -t mojaloop/central-ledger:local \
  .
```

```bash
npm run test:functional
```

By default this will clone the [ml-core-test-harness](https://github.com/mojaloop/ml-core-test-harness) into `$ML_CORE_TEST_HARNESS_DIR`.

See default values as specified in the [test-functional.sh](./test/scripts/test-functional.sh) script.

Check test container logs for test results into `$ML_CORE_TEST_HARNESS_DIR` directory.

If you want to not have the [ml-core-test-harness](https://github.com/mojaloop/ml-core-test-harness) shutdown automatically by the script, make sure you set the following env var `export ML_CORE_TEST_SKIP_SHUTDOWN=true`.

By doing so, you are then able access TTK UI using the following URI: <http://localhost:9660>.

Or alternatively, you can monitor the `ttk-func-ttk-tests-1` (See `ML_CORE_TEST_HARNESS_TEST_FUNC_CONT_NAME` in the [test-functional.sh](./test/scripts/test-functional.sh) script) container for test results with the following command:

```bash
docker logs -f ttk-func-ttk-tests-1
```

TTK Test files:

- **Test Collection**: `$ML_CORE_TEST_HARNESS_DIR/docker/ml-testing-toolkit/test-cases/collections/tests/p2p.json`
- **Env Config**: `$ML_CORE_TEST_HARNESS_DIR//docker/ml-testing-toolkit/test-cases/environments/default-env.json`

Configuration modifiers:

- **central-ledger**: [./docker/config-modifier/configs/central-ledger.js](./docker/config-modifier/configs/central-ledger.js)

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

We use `audit-ci` along with `npm audit` to check dependencies for node vulnerabilities, and keep track of resolved dependencies with an `audit-ci.jsonc` file.

To start a new resolution process, run:

```bash
npm run audit:fix
```

You can then check to see if the CI will pass based on the current dependencies with:

```bash
npm run audit:check
```

The [audit-ci.jsonc](./audit-ci.jsonc) contains any audit-exceptions that cannot be fixed to ensure that CircleCI will build correctly.

## Container Scans

As part of our CI/CD process, we use grype a vulnerability scanner for container images and filesystems upon release.

If you find your release builds are failing, please review Mojaloop orb with grype image scan at [container scanning](https://github.com/mojaloop/ci-config-orb-build?tab=readme-ov-file#vulnerability-image-scan-configuration) and review [grype_image_scan.yml](https://github.com/mojaloop/ci-config-orb-build/blob/main/src/jobs/grype_image_scan.yml) job.

For more information on grype, refer to:

- [Grype](https://github.com/anchore/grype)

## Automated Releases

As part of our CI/CD process, we use a combination of CircleCI, standard-version
npm package and github-release CircleCI orb to automatically trigger our releases
and image builds. This process essentially mimics a manual tag and release.

On a merge to main, CircleCI is configured to use the mojaloopci github account
to push the latest generated CHANGELOG and package version number.

Once those changes are pushed, CircleCI will pull the updated main, tag and
push a release triggering another subsequent build that also publishes a docker image.

### Potential problems

- There is a case where the merge to main workflow will resolve successfully, triggering
  a release. Then that tagged release workflow subsequently failing due to the image scan,
  audit check, vulnerability check or other "live" checks.

  This will leave main without an associated published build. Fixes that require
  a new merge will essentially cause a skip in version number or require a clean up
  of the main branch to the commit before the CHANGELOG and bump.

  This may be resolved by relying solely on the previous checks of the
  merge to main workflow to assume that our tagged release is of sound quality.
  We are still mulling over this solution since catching bugs/vulnerabilities/etc earlier
  is a boon.

- It is unknown if a race condition might occur with multiple merges with main in
  quick succession, but this is a suspected edge case.
