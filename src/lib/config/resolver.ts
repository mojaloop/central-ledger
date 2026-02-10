/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------

 ******/

import path from 'node:path'
import parseStringsInObject from 'parse-strings-in-object'
import RC from 'rc'
import { ApplicationConfig } from './types'
import { assertBoolean, assertDatabaseConfig, assertDistLockConfig, assertInstrumentationConfig, assertInstrumentationMetricsLabels, assertKafkaConfig, assertNestedFields, assertNumber, assertProvisioning, assertProxyCacheConfig, assertString, defaultEnvString, defaultTo, kafkaWithBrokerDefaults } from './util'
import assert from 'node:assert'
import { logger } from '../../shared/logger'

type UnsafeApplicationConfig = Partial<ApplicationConfig>

const resolveConfig = (rawConfig: any): UnsafeApplicationConfig => {
  const defaultBroker = defaultTo(rawConfig.KAFKA.DEFAULT_BROKER, 'localhost:9092')
  const kafka = kafkaWithBrokerDefaults(rawConfig.KAFKA, defaultBroker)

  // Make sure nested fields we depend upon exist.
  assertNestedFields(rawConfig, 'DATABASE')
  assertNestedFields(rawConfig, 'MIGRATIONS')
  assertNestedFields(rawConfig, 'AMOUNT')
  assertNestedFields(rawConfig, 'MONGODB')
  assertNestedFields(rawConfig, 'HANDLERS')
  assertNestedFields(rawConfig, 'HANDLERS.API')
  assertNestedFields(rawConfig, 'HANDLERS.TIMEOUT')
  assertNestedFields(rawConfig, 'HANDLERS.TIMEOUT.DIST_LOCK')
  assertNestedFields(rawConfig, 'HANDLERS.TIMEOUT.DIST_LOCK.redisConfigs')
  assertNestedFields(rawConfig, 'INSTRUMENTATION')
  assertNestedFields(rawConfig, 'HUB_PARTICIPANT')

  const unsafeConfig: UnsafeApplicationConfig = {
    PORT: rawConfig.PORT,
    HOSTNAME: rawConfig.HOSTNAME.replace(/\/$/, ''),
    DATABASE: {
      client: rawConfig.DATABASE.DIALECT,
      connection: {
        host: rawConfig.DATABASE.HOST.replace(/\/$/, ''),
        port: rawConfig.DATABASE.PORT,
        user: rawConfig.DATABASE.USER,
        password: rawConfig.DATABASE.PASSWORD,
        database: rawConfig.DATABASE.SCHEMA
      },
      pool: {
        min: rawConfig.DATABASE.POOL_MIN_SIZE,
        max: rawConfig.DATABASE.POOL_MAX_SIZE,
        acquireTimeoutMillis: rawConfig.DATABASE.ACQUIRE_TIMEOUT_MILLIS,
        createTimeoutMillis: rawConfig.DATABASE.CREATE_TIMEOUT_MILLIS,
        destroyTimeoutMillis: rawConfig.DATABASE.DESTROY_TIMEOUT_MILLIS,
        idleTimeoutMillis: rawConfig.DATABASE.IDLE_TIMEOUT_MILLIS,
        reapIntervalMillis: rawConfig.DATABASE.REAP_INTERVAL_MILLIS,
        createRetryIntervalMillis: rawConfig.DATABASE.CREATE_RETRY_INTERVAL_MILLIS
      },
      debug: rawConfig.DATABASE.DEBUG
    },
    MAX_FULFIL_TIMEOUT_DURATION_SECONDS: defaultTo(rawConfig.MAX_FULFIL_TIMEOUT_DURATION_SECONDS, 300),
    RUN_MIGRATIONS: !rawConfig.MIGRATIONS.DISABLED,
    RUN_DATA_MIGRATIONS: rawConfig.MIGRATIONS.RUN_DATA_MIGRATIONS,
    AMOUNT: {
      PRECISION: rawConfig.AMOUNT.PRECISION,
      SCALE: rawConfig.AMOUNT.SCALE,
    },
    MONGODB_HOST: rawConfig.MONGODB.HOST,
    MONGODB_PORT: rawConfig.MONGODB.PORT,
    MONGODB_USER: rawConfig.MONGODB.USER,
    MONGODB_PASSWORD: rawConfig.MONGODB.PASSWORD,
    MONGODB_DATABASE: rawConfig.MONGODB.DATABASE,
    MONGODB_DEBUG: rawConfig.MONGODB.DEBUG === true,
    MONGODB_DISABLED: rawConfig.MONGODB.DISABLED === true,
    ERROR_HANDLING: rawConfig.ERROR_HANDLING,
    HANDLERS_DISABLED: rawConfig.HANDLERS.DISABLED,
    HANDLERS_API_DISABLED: rawConfig.HANDLERS.API.DISABLED,
    HANDLERS_TIMEOUT: rawConfig.HANDLERS.TIMEOUT,
    HANDLERS_TIMEOUT_DISABLED: rawConfig.HANDLERS.TIMEOUT.DISABLED,
    HANDLERS_TIMEOUT_TIMEXP: rawConfig.HANDLERS.TIMEOUT.TIMEXP,
    HANDLERS_TIMEOUT_TIMEZONE: rawConfig.HANDLERS.TIMEOUT.TIMEZONE,
    INSTRUMENTATION_METRICS_DISABLED: rawConfig.INSTRUMENTATION.METRICS.DISABLED,
    INSTRUMENTATION_METRICS_LABELS: rawConfig.INSTRUMENTATION.METRICS.labels,
    INSTRUMENTATION_METRICS_CONFIG: rawConfig.INSTRUMENTATION.METRICS.config,
    PARTICIPANT_INITIAL_POSITION: defaultTo(rawConfig.PARTICIPANT_INITIAL_POSITION, 0),
    HUB_ID: rawConfig.HUB_PARTICIPANT.ID,
    HUB_NAME: rawConfig.HUB_PARTICIPANT.NAME,
    HUB_ACCOUNTS: rawConfig.HUB_PARTICIPANT.ACCOUNTS,
    INTERNAL_TRANSFER_VALIDITY_SECONDS: defaultTo(rawConfig.INTERNAL_TRANSFER_VALIDITY_SECONDS, 432000),
    ENABLE_ON_US_TRANSFERS: rawConfig.ENABLE_ON_US_TRANSFERS,
    PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED: rawConfig.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED,
    CACHE_CONFIG: rawConfig.CACHE,
    PROXY_CACHE_CONFIG: rawConfig.PROXY_CACHE,
    API_DOC_ENDPOINTS_ENABLED: defaultTo(rawConfig.API_DOC_ENDPOINTS_ENABLED, false),
    KAFKA_CONFIG: kafka,
    SERVER_PRINT_ROUTES_ON_STARTUP: defaultTo(rawConfig.SERVER_PRINT_ROUTES_ON_STARTUP, true),
    LEDGER: defaultTo(rawConfig.LEDGER, 'LEGACY'),
    EXPERIMENTAL: {
      PROVISIONING: {
        enabled: defaultTo(rawConfig.EXPERIMENTAL?.PROVISIONING?.enabled, false),
        currencies: defaultTo(rawConfig.EXPERIMENTAL?.PROVISIONING?.currencies, []),
        hubAlertEmailAddress: rawConfig.EXPERIMENTAL?.PROVISIONING?.hubAlertEmailAddress,
      },
    }
  }
  return unsafeConfig
}

const parseAndValidateConfig = (unsafeConfig: UnsafeApplicationConfig): ApplicationConfig => {
  assertNumber(unsafeConfig.PORT)
  assertString(unsafeConfig.HOSTNAME)
  assertDatabaseConfig(unsafeConfig.DATABASE)
  assertNumber(unsafeConfig.MAX_FULFIL_TIMEOUT_DURATION_SECONDS)
  assertString(unsafeConfig.MONGODB_HOST)
  assertNumber(unsafeConfig.MONGODB_PORT)
  assertString(unsafeConfig.MONGODB_USER)
  assertString(unsafeConfig.MONGODB_DATABASE)
  assertBoolean(unsafeConfig.MONGODB_DEBUG)
  assertBoolean(unsafeConfig.MONGODB_DISABLED)
  assertNumber(unsafeConfig.AMOUNT.PRECISION)
  assertNumber(unsafeConfig.AMOUNT.SCALE)
  assertBoolean(unsafeConfig.ERROR_HANDLING.includeCauseExtension)
  assertBoolean(unsafeConfig.ERROR_HANDLING.truncateExtensions)
  assertBoolean(unsafeConfig.HANDLERS_DISABLED)
  assertBoolean(unsafeConfig.HANDLERS_API_DISABLED)
  assertDistLockConfig(unsafeConfig.HANDLERS_TIMEOUT.DIST_LOCK)
  assertBoolean(unsafeConfig.HANDLERS_TIMEOUT.DISABLED)
  assertString(unsafeConfig.HANDLERS_TIMEOUT.TIMEXP)
  assertString(unsafeConfig.HANDLERS_TIMEOUT.TIMEZONE)
  assertBoolean(unsafeConfig.HANDLERS_TIMEOUT_DISABLED)
  assertString(unsafeConfig.HANDLERS_TIMEOUT_TIMEXP)
  assertString(unsafeConfig.HANDLERS_TIMEOUT_TIMEZONE)
  assertBoolean(unsafeConfig.CACHE_CONFIG.CACHE_ENABLED)
  assertNumber(unsafeConfig.CACHE_CONFIG.MAX_BYTE_SIZE)
  assertNumber(unsafeConfig.CACHE_CONFIG.EXPIRES_IN_MS)
  assertBoolean(unsafeConfig.PROXY_CACHE_CONFIG.enabled)
  assertString(unsafeConfig.PROXY_CACHE_CONFIG.type)
  assertProxyCacheConfig(unsafeConfig.PROXY_CACHE_CONFIG.proxyConfig)
  assertKafkaConfig(unsafeConfig.KAFKA_CONFIG)
  assertNumber(unsafeConfig.PARTICIPANT_INITIAL_POSITION)
  assertBoolean(unsafeConfig.RUN_MIGRATIONS)
  assertBoolean(unsafeConfig.RUN_DATA_MIGRATIONS)
  assertNumber(unsafeConfig.INTERNAL_TRANSFER_VALIDITY_SECONDS)
  assertBoolean(unsafeConfig.ENABLE_ON_US_TRANSFERS)
  assertNumber(unsafeConfig.HUB_ID)
  assertString(unsafeConfig.HUB_NAME)
  assert.ok(Array.isArray(unsafeConfig.HUB_ACCOUNTS))
  unsafeConfig.HUB_ACCOUNTS.forEach(unsafeAccountStr => assert(unsafeAccountStr))
  assertBoolean(unsafeConfig.INSTRUMENTATION_METRICS_DISABLED)
  assertInstrumentationMetricsLabels(unsafeConfig.INSTRUMENTATION_METRICS_LABELS)
  assertInstrumentationConfig(unsafeConfig.INSTRUMENTATION_METRICS_CONFIG)
  assertBoolean(unsafeConfig.API_DOC_ENDPOINTS_ENABLED)
  assertBoolean(unsafeConfig.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED)
  assertBoolean(unsafeConfig.SERVER_PRINT_ROUTES_ON_STARTUP)

  assert(unsafeConfig.EXPERIMENTAL)
  assertProvisioning(unsafeConfig.EXPERIMENTAL.PROVISIONING)

  // Now assert config business logic - apply rules.
  if (unsafeConfig.LEDGER !== 'LEGACY') {
    throw new Error(`LEDGER must be LEGACY. TIGERBEETLE and LOCKSTEP ledgers are currently unsupported.`)
  }

  if (unsafeConfig.EXPERIMENTAL.PROVISIONING.enabled) {
    throw new Error(`PROVISIONING not currently implemented.`)
  }

  return unsafeConfig as ApplicationConfig
}

const makeConfig = (): ApplicationConfig => {
  const PATH_TO_CONFIG_FILE = defaultEnvString(
    process.env,
    'PATH_TO_CONFIG_FILE', 
    path.join(__dirname, '../../..', 'config/default.json')
  )
  logger.warn(`makeConfig() - Loading config from: ${PATH_TO_CONFIG_FILE}`)
  const raw = parseStringsInObject(RC('CLEDG', require(PATH_TO_CONFIG_FILE)))
  const resolved = resolveConfig(raw)
  const validated = parseAndValidateConfig(resolved)

  return validated
}

export { makeConfig, resolveConfig, parseAndValidateConfig }
