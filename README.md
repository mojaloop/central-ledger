# central-ledger
[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/central-ledger.svg?style=flat)](https://github.com/mojaloop/central-ledger/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/central-ledger.svg?style=flat)](https://github.com/mojaloop/central-ledger/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/central-ledger.svg?style=flat)](https://hub.docker.com/r/mojaloop/central-ledger)
[![CircleCI](https://circleci.com/gh/mojaloop/central-ledger.svg?style=svg)](https://app.circleci.com/pipelines/github/mojaloop/central-ledger)

The central ledger is a series of services that facilitate clearing and settlement of transfers between DFSPs, including the following functions:

- Brokering real-time messaging for funds clearing
- Maintaining net positions for a deferred net settlement
- Propagating scheme-level and off-transfer fees

The following documentation represents the services, APIs and endpoints responsible for various ledger functions.

## Contents:

- [Running Locally](#running-locally)
- [Configuration](#configuration)
- [API](#api)
- [Logging](#logging)
- [Tests](#tests)
- [Auditing Dependencies](#auditing-dependencies)
- [Container Scans](#container-scans)

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
| CLEDG\_HOSTNAME | The URI that will be used to create and validate links to resources on the central ledger.  | http://central-ledger |
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

### Running Integration Tests interactively-ish

If you want to run integration tests in a repetitive manner, you can startup the test containers using `docker-compose`, login to running `central-ledger` container like so:

```bash
docker-compose -f docker-compose.yml -f docker-compose.integration.yml up kafka mysql central-ledger

#in a new shell
docker exec -it cl_central-ledger sh
npm run migrate #first time only
npm run test:int
```

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

