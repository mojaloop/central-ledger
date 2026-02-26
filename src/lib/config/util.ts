/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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

import assert from 'node:assert'
import { ApplicationConfig, DatabaseConfig, DistLockConfig, InstrumentationConfig, InstrumentationMetricsLabels, KafkaConfig, KafkaConsumerConfig, KafkaProducerConfig } from './types'
import { logger } from '../../shared/logger'
import { MySqlProxyCacheConfig, RedisClusterProxyCacheConfig, RedisProxyCacheConfig } from '@mojaloop/inter-scheme-proxy-cache-lib'

class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

/**
 * @function assertString
 * @description Assert that the input is a string.
 */
export function assertString(input: unknown): void {
  if (typeof input !== 'string') {
    throw new ConfigValidationError(`assertString() expected 'string', instead found ${typeof input}`)
  }
}

/**
 * @function assertNumber
 * @description Assert that the input is a number.
 */
export function assertNumber(input: unknown): void {
  if (typeof input !== 'number') {
    throw new ConfigValidationError(`assertNumber() expected 'number', instead found ${typeof input}`)
  }

  if (Number.isNaN(input)) {
    throw new ConfigValidationError(`assertNumber() expected 'number', instead found NaN`)
  }
}

/**
 * @function assertBoolean
 * @description Assert that the input is a boolean.
 */
export function assertBoolean(input: unknown): void {
  if (typeof input !== 'boolean') {
    throw new ConfigValidationError(`assertNumber() expected 'boolean', instead found ${typeof input}`)
  }
}

/**
 * @function assertStringOrNull
 * @description Assert that the input is a string or null.
 */
export function assertStringOrNull(input: unknown): void {
  if (input === null) {
    return
  }

  return assertString(input)
}

/**
 * @function assertStringIfDefined
 * @description Assert that the input is a string if it is defined.
 */
export function assertStringIfDefined(input: unknown): void {
  if (input === undefined) {
    return
  }
  assertString(input)
}

/**
 * @function assertNumberIfDefined
 * @description Assert that the input is a number if it is defined.
 */
export function assertNumberIfDefined(input: unknown): void {
  if (input === undefined) {
    return
  }
  assertNumber(input)
}

/**
 * @function assertBooleanIfDefined
 * @description Assert that the input is a boolean if it is defined.
 */
export function assertBooleanIfDefined(input: unknown): void {
  if (input === undefined) {
    return
  }
  assertBoolean(input)
}

/**
 * @function assertProxyCacheConfig
 * @description Assert that the proxy cache config is defined.
 */
export function assertProxyCacheConfig(input: unknown): void {
  assert(input)
  if ((input as RedisClusterProxyCacheConfig).cluster) {
    const unsafeConfigCluster = input as RedisClusterProxyCacheConfig
    assert(Array.isArray(unsafeConfigCluster.cluster), 'Expected `cluster` to be an array.')
    assert(unsafeConfigCluster.cluster.length > 0, 'Expected .cluster to contain at least 1 item.')
    for (const node of unsafeConfigCluster.cluster) {
      assertString(node.host)
      assertNumber(node.port)
    }
    assertStringIfDefined(unsafeConfigCluster.username)
    assertStringIfDefined(unsafeConfigCluster.password)
    assertBooleanIfDefined(unsafeConfigCluster.lazyConnect)
    assertNumberIfDefined(unsafeConfigCluster.db)

    return
  }
  const unsafeEither = input as RedisProxyCacheConfig | MySqlProxyCacheConfig
  const unsafeRedis = input as RedisProxyCacheConfig
  const unsafeMySQL = input as MySqlProxyCacheConfig

  assertString(unsafeEither.host)
  assertNumber(unsafeEither.port)

  // Optional RedisOptions fields.
  assertStringIfDefined(unsafeRedis.username)
  assertStringIfDefined(unsafeRedis.password)
  assertBooleanIfDefined(unsafeRedis.lazyConnect)
  assertNumberIfDefined(unsafeRedis.db)

  // Optional MySqlProxyCacheConfig fields.
  assertStringIfDefined(unsafeMySQL.database)
  assertStringIfDefined(unsafeMySQL.user)
}

/**
 * @function assertKafkaConsumerConfig
 * @description Assert that a Kafka consumer config is valid.
 */
export function assertKafkaConsumerConfig(input: unknown): void {
  const unsafeConsumerConfig = input as KafkaConsumerConfig
  assert(unsafeConsumerConfig)
  assert(unsafeConsumerConfig.config)
  assert(unsafeConsumerConfig.config.options)
  assert(unsafeConsumerConfig.config.rdkafkaConf)
  assert(unsafeConsumerConfig.config.topicConf)
}

/**
 * @function assertKafkaProducerConfig
 * @description Assert that a Kafka producer config is valid.
 */
export function assertKafkaProducerConfig(input: unknown): void {
  const unsafeProducerConfig = input as KafkaProducerConfig
  assert(unsafeProducerConfig)
  assert(unsafeProducerConfig.config)
  assert(unsafeProducerConfig.config.options)
  assert(unsafeProducerConfig.config.rdkafkaConf)
  assert(unsafeProducerConfig.config.topicConf)
}

/**
 * @function assertKafkaConfig
 * @description Assert that the Kafka config is valid.
 */
export function assertKafkaConfig(input: unknown): void {
  const unsafeConfig = input as KafkaConfig
  assertNestedFields(unsafeConfig, 'EVENT_TYPE_ACTION_TOPIC_MAP.POSITION')

  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.FX_PREPARE)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.BULK_PREPARE)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.COMMIT)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.BULK_COMMIT)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.RESERVE)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.FX_RESERVE)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.TIMEOUT_RESERVED)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.FX_TIMEOUT_RESERVED)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.ABORT)
  assertStringOrNull(unsafeConfig.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.FX_ABORT)

  assertNestedFields(unsafeConfig, 'TOPIC_TEMPLATES.PARTICIPANT_TOPIC_TEMPLATE.TEMPLATE')
  assertNestedFields(unsafeConfig, 'TOPIC_TEMPLATES.PARTICIPANT_TOPIC_TEMPLATE.REGEX')
  assertNestedFields(unsafeConfig, 'TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE')
  assertNestedFields(unsafeConfig, 'TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.REGEX')

  // Check the Consumer Configs. We can just check the leaf nodes.
  assertNestedFields(unsafeConfig, 'CONSUMER.BULK.PREPARE')
  assertNestedFields(unsafeConfig, 'CONSUMER.BULK.PROCESSING')
  assertNestedFields(unsafeConfig, 'CONSUMER.BULK.FULFIL')
  assertNestedFields(unsafeConfig, 'CONSUMER.BULK.GET')
  assertNestedFields(unsafeConfig, 'CONSUMER.TRANSFER.PREPARE')
  assertNestedFields(unsafeConfig, 'CONSUMER.TRANSFER.GET')
  assertNestedFields(unsafeConfig, 'CONSUMER.TRANSFER.FULFIL')
  assertNestedFields(unsafeConfig, 'CONSUMER.TRANSFER.POSITION')
  assertNestedFields(unsafeConfig, 'CONSUMER.TRANSFER.POSITION_BATCH')
  assertNestedFields(unsafeConfig, 'CONSUMER.ADMIN.TRANSFER')
  assertNestedFields(unsafeConfig, 'CONSUMER.NOTIFICATION.EVENT')
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.BULK.PREPARE)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.BULK.PROCESSING)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.BULK.FULFIL)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.BULK.GET)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.TRANSFER.PREPARE)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.TRANSFER.GET)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.TRANSFER.FULFIL)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.TRANSFER.POSITION)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.TRANSFER.POSITION_BATCH)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.ADMIN.TRANSFER)
  assertKafkaConsumerConfig(unsafeConfig.CONSUMER.NOTIFICATION.EVENT)

  // Check the Producer Configs.
  assert(unsafeConfig.PRODUCER)
  assert(unsafeConfig.PRODUCER.BULK)
  assert(unsafeConfig.PRODUCER.BULK.PROCESSING)
  assert(unsafeConfig.PRODUCER.TRANSFER)
  assert(unsafeConfig.PRODUCER.TRANSFER.PREPARE)
  assert(unsafeConfig.PRODUCER.TRANSFER.FULFIL)
  assert(unsafeConfig.PRODUCER.TRANSFER.POSITION)
  assert(unsafeConfig.PRODUCER.NOTIFICATION)
  assert(unsafeConfig.PRODUCER.NOTIFICATION.EVENT)
  assert(unsafeConfig.PRODUCER.ADMIN)
  assert(unsafeConfig.PRODUCER.ADMIN.TRANSFER)

  assertKafkaProducerConfig(unsafeConfig.PRODUCER.BULK.PROCESSING)
  assertKafkaProducerConfig(unsafeConfig.PRODUCER.TRANSFER.PREPARE)
  assertKafkaProducerConfig(unsafeConfig.PRODUCER.TRANSFER.FULFIL)
  assertKafkaProducerConfig(unsafeConfig.PRODUCER.TRANSFER.POSITION)
  assertKafkaProducerConfig(unsafeConfig.PRODUCER.NOTIFICATION.EVENT)
  assertKafkaProducerConfig(unsafeConfig.PRODUCER.ADMIN.TRANSFER)
}

/**
 * @function assertDatabaseConfig
 * @description Assert that the Database config is valid.
 */
export function assertDatabaseConfig(input: unknown): void {
  const unsafeConfig = input as DatabaseConfig
  assertString(unsafeConfig.client)
  assert(unsafeConfig.connection, 'Expected `.connection` to be defined.')
  assertString(unsafeConfig.connection.host)
  assertNumber(unsafeConfig.connection.port)
  assertString(unsafeConfig.connection.user)
  assertString(unsafeConfig.connection.password)
  assertString(unsafeConfig.connection.database)
  assert(unsafeConfig.pool, 'Expected `.pool` to be defined.')
  assertNumber(unsafeConfig.pool.min)
  assertNumber(unsafeConfig.pool.max)
  assertNumber(unsafeConfig.pool.acquireTimeoutMillis)
  assertNumber(unsafeConfig.pool.createTimeoutMillis)
  assertNumber(unsafeConfig.pool.destroyTimeoutMillis)
  assertNumber(unsafeConfig.pool.idleTimeoutMillis)
  assertNumber(unsafeConfig.pool.reapIntervalMillis)
  assertNumber(unsafeConfig.pool.createRetryIntervalMillis)
  assertBoolean(unsafeConfig.debug)
}

/**
 * @function assertInstrumentationMetricsLabels
 * @description Assert that the instrumentation metrics labels config is valid.
 */
export function assertInstrumentationMetricsLabels(input: unknown): void {
  assert(input, 'Expected instrumentation metrics labels to be defined')
  const unsafeConfig = input as InstrumentationMetricsLabels
  assertString(unsafeConfig.fspId)
}

/**
 * @function assertInstrumentationConfig
 * @description Assert that the instrumentation config is valid.
 */
export function assertInstrumentationConfig(input: unknown): void {
  assert(input, 'Expected instrumentation config to be defined')
  const unsafeConfig = input as InstrumentationConfig
  assertNumber(unsafeConfig.timeout)
  assertString(unsafeConfig.prefix)
  assert(unsafeConfig.defaultLabels, 'Expected `.defaultLabels` to be defined')
  assertString(unsafeConfig.defaultLabels.serviceName)
}

/**
 * @function assertDistLockConfig
 * @description Assert that the distributed lock config is valid.
 */
export function assertDistLockConfig(input: unknown): void {
  assert(input, 'Expected dist lock config to be defined')
  const unsafeConfig = input as DistLockConfig
  assertBoolean(unsafeConfig.enabled)
  assertNumber(unsafeConfig.lockTimeout)
  assertNumber(unsafeConfig.acquireTimeout)
  assertNumber(unsafeConfig.driftFactor)
  assertNumber(unsafeConfig.retryCount)
  assertNumber(unsafeConfig.retryDelay)
  assertNumber(unsafeConfig.retryJitter)
  assert(Array.isArray(unsafeConfig.redisConfigs), 'Expected `.redisConfigs` to be an array')
  for (const redisConfig of unsafeConfig.redisConfigs) {
    assertString(redisConfig.type)
    assert(Array.isArray(redisConfig.cluster), 'Expected `.cluster` to be an array')
    for (const node of redisConfig.cluster) {
      assertString(node.host)
      assertNumber(node.port)
    }
  }
}

/**
 * @function assertProvisioning
 * @description Assert that the provisioning config is valid.
 */
export function assertProvisioning(input: unknown): void {
  assert(input, 'Expected provisioning config to be defined.')
  const unsafeConfig = input as ApplicationConfig['EXPERIMENTAL']['PROVISIONING']

  assertBoolean(unsafeConfig.enabled)
  if (unsafeConfig.enabled === false) {
    return
  }

  assert(Array.isArray(unsafeConfig.currencies) && unsafeConfig.currencies.length > 0,
    'expected .currencies to be an array with at least one element'
  )
  unsafeConfig.currencies.forEach(currency => assertString(currency))
  assertStringIfDefined(unsafeConfig.hubAlertEmailAddress)
}

/**
 * @function defaultTo
 * @description Return the input if defined, otherwise return the default value.
 */
export function defaultTo<T>(input: unknown, defaultValue: T): T {
  if (input === undefined) {
    return defaultValue
  }

  assert.equal(typeof input, typeof defaultValue)
  return input as T
}

/**
 * @function stringToBoolean
 * @description Convert a string 'true' or 'false' to a boolean.
 */
export function stringToBoolean(input: string): boolean {
  assert(input !== undefined)
  assert(typeof input === 'string')

  switch (input.toLowerCase()) {
    case 'true': return true
    case 'false': return false
    default: {
      throw new Error(`stringToBoolean, unknown input: ${input}`)
    }
  }
}

/**
 * @function defaultEnvString
 * @description Get an environment variable or return a default value.
 */
export function defaultEnvString(env: NodeJS.ProcessEnv, name: string, defaultValue: string): string {
  assert(env, 'Expected env to be defined.')
  assert(typeof name === 'string', 'Expected `name` to be a string.')
  assert(defaultValue, 'Expected a default value.')
  assert(typeof defaultValue === 'string', 'Expected default value to be a string')

  let processEnvValue = env[name]
  if (Array.isArray(processEnvValue)) {
    processEnvValue = processEnvValue[0]
  }
  // Need to protect for cases where the value may intentionally false!
  if (processEnvValue === undefined) {
    logger.warn(`defaultEnvString - ${name} not set - defaulting to: ${defaultValue}`)
    return defaultValue
  }

  logger.warn(`defaultEnvString - ${name} is  set - resolved   to: ${processEnvValue}`)
  return processEnvValue
}

/**
 * @function kafkaWithBrokerDefaults
 * @description Configure the metadata.broker.list without needing to touch each individual config. 
 *   If config.rdkafkaConf['metadata.broker.list'] is already set, then this doesn't modify it.
 */
export function kafkaWithBrokerDefaults(input: KafkaConfig, defaultBroker: string): KafkaConfig {
  assert(defaultBroker)
  assert(input.CONSUMER)
  assert(input.PRODUCER)

  Object.keys(input).filter(groupKey => {
    if (groupKey === 'CONSUMER') {
      return true
    }
    if (groupKey === 'PRODUCER') {
      return true
    }
    return false
  }).forEach(groupKey => {
    const group = input[groupKey]

    Object.keys(group).forEach(key => {
      const topic = input[groupKey][key]
      Object.keys(topic).forEach(topicKey => {
        const leafConfig = topic[topicKey]
        const path = `input.${groupKey}.${key}.${topicKey}`
        if (leafConfig?.config?.rdkafkaConf
          && !leafConfig.config.rdkafkaConf['metadata.broker.list']
        ) {
          logger.debug(`Config kafkaWithBrokerDefaults() defaulting: ${path}.config.rdkafkaConf['metadata.broker.list'] with: ${defaultBroker}`)
          input[groupKey][key][topicKey]['config']['rdkafkaConf']['metadata.broker.list'] = defaultBroker
        }
      })
    })
  })

  return input
}

/**
 * @function convertBigIntToNumber
 * @description Converts a bigint to a number, throwing an error if the bigint is outside of the 
 *  range (MIN_SAFE_INTEGER, MAX_SAFE_INTEGER).
 */
export function convertBigIntToNumber(input: bigint): number {
  if (input > BigInt(Number.MAX_SAFE_INTEGER) ||
    input < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(`convertBigIntToNumber failed: input is outside of safe range.`)
  }

  return Number(input)
}

/**
 * @function safeStringToNumber
 * @description Safetly convert from a string representation of a number to a number.
 */
export function safeStringToNumber(input: string) {
  assert(typeof input === 'string')
  const trimmed = input.trim()

  // Check if it's a valid number string.
  if (trimmed === '' || Number.isNaN(Number(trimmed))) {
    throw new TypeError(`Invalid number string: "${input}".`)
  }

  const num = Number(trimmed)
  if (!Number.isFinite(num)) {
    throw new TypeError(`Number out of range: "${input}".`)
  }

  return num
}

/**
 * @function assertRange
 * @description Assert that an input number is within a specified range.
 */
export function assertRange(input: any, minInclusive: number, maxInclusive: number): void {
  assert(maxInclusive > minInclusive, `assertRange invalid args - expected maxInclusive > minInclusive.`)
  assert(typeof input === 'number')
  assert(input >= minInclusive && input <= maxInclusive, `assertRange valid range: [${minInclusive}, ${maxInclusive}].`)
}

/**
 * @function assertNestedFields
 * @description Assert that a nested field is defined in the raw config.
 */
export function assertNestedFields(rawConfig: any, path: string): void {
  const parts = path.split('.')
  let current = rawConfig
  let traversed = ''

  for (const part of parts) {
    traversed = traversed ? `${traversed}.${part}` : part
    assert(current[part] !== undefined, `expected \`${traversed}\` to be defined`)
    current = current[part]
  }
}