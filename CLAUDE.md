# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Central-ledger is the core Mojaloop service responsible for:
- Brokering real-time messaging for funds clearing
- Maintaining net positions for deferred net settlement
- Propagating scheme-level and off-transfer fees

This service manages the central database schema used by other Mojaloop services (e.g., central-settlement).

## Common Commands

```bash
# Start the API server
npm start

# Run unit tests
npm test

# Run a single unit test file
npx tape 'test/unit/path/to/file.test.js' | tap-spec

# Run unit tests with coverage
npm run test:coverage

# Run integration tests (requires docker containers)
npm run test:int:spec

# Run integration tests with override topic mapping (batch processing)
npm run test:int-override

# Lint code
npm run lint
npm run lint:fix

# Database operations
npm run migrate          # Run migrations + seeds
npm run migrate:latest   # Run migrations only
npm run migrate:rollback # Rollback last migration
npm run seed:run         # Run seeds only

# Build and run with Docker
npm run docker:build
npm run docker:up

# Start specific handlers via CLI
node src/handlers/index.js handler --prepare
node src/handlers/index.js handler --position
node src/handlers/index.js handler --positionbatch
node src/handlers/index.js handler --fulfil
node src/handlers/index.js handler --timeout
node src/handlers/index.js handler --admin
node src/handlers/index.js handler --bulkprepare
node src/handlers/index.js handler --bulkfulfil
node src/handlers/index.js handler --bulkprocessing
node src/handlers/index.js handler --bulkget
```

## Architecture

### Entry Points
- **API Server** (`src/api/index.js`): REST API for ledger operations, runs on port 3001
- **Handlers CLI** (`src/handlers/index.js`): Kafka message handlers started via command-line flags

### Code Organization
```
src/
├── api/              # REST API routes and handlers (Hapi.js)
├── domain/           # Business logic layer
│   ├── transfer/     # Transfer processing
│   ├── participant/  # Participant management
│   ├── position/     # Position calculations
│   ├── settlement/   # Settlement operations
│   ├── fx/           # FX transfer support
│   └── bulkTransfer/ # Bulk transfer processing
├── handlers/         # Kafka event handlers
│   ├── transfers/    # Transfer lifecycle (prepare, fulfil)
│   ├── positions/    # Position processing (single & batch)
│   ├── bulk/         # Bulk transfer handlers
│   ├── timeouts/     # Transfer timeout handler
│   └── admin/        # Admin operations handler
├── models/           # Data access layer (Knex.js)
├── lib/              # Utilities
│   ├── config.js     # Configuration management
│   ├── db.js         # Database connection
│   ├── cache.js      # In-memory caching
│   ├── distLock.js   # Distributed locking (Redis)
│   └── proxyCache.js # Proxy caching for cross-network
└── shared/           # Shared setup and logging
```

### Key Handler Types
- **prepare**: Validates and records incoming transfers
- **position**: Updates participant positions (net debit cap checks)
- **positionbatch**: Batch processing for high-throughput position updates
- **fulfil**: Completes transfers on fulfillment
- **timeout**: Expires transfers past their validity period
- **admin**: Handles administrative operations

### Database
- MySQL with Knex.js via `@mojaloop/database-lib`
- 220+ migrations in `migrations/` directory
- Schema: `central_ledger` (shared with central-settlement)
- Seed data in `seeds/` for lookup tables

### Testing
- **Framework**: tape (not Jest)
- **Pattern**: Tests in `test/unit/` mirror source structure
- **Mocking**: Uses sinon and proxyquire
- **Integration**: `test/integration/` and `test/integration-override/` (for batch processing)

### Configuration
- Primary config: `config/default.json`
- Environment variable prefix: `CLEDG_` (double underscore for nested: `CLEDG_KAFKA__CONSUMER__...`)
- Knex config: `config/knexfile.js`

### Batch Processing
Position batch processing can be enabled for high-throughput scenarios:
1. Configure `KAFKA.EVENT_TYPE_ACTION_TOPIC_MAP` to route messages to batch topic
2. Run `--positionbatch` handler alongside regular handlers
3. See README.md for detailed configuration

## Node.js Version

Always run `nvm use` when entering the repository. The project uses Node.js 22.x (see `.nvmrc`).

## Local Development Setup

```bash
# Start dependencies
docker compose up -d mysql kafka init-kafka redis-node-0 redis-node-1 redis-node-2 redis-node-3 redis-node-4 redis-node-5

# Wait for containers
npm run wait-4-docker

# Run migrations
npm run migrate

# Start the service
npm start
```
