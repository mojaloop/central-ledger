/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the 'License') and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  assertString,
  assertNumber,
  assertBoolean,
  assertStringOrNull,
  assertProxyCacheConfig,
  defaultTo,
  stringToBoolean,
  convertBigIntToNumber,
  safeStringToNumber,
  assertRange,
  assertNestedFields,
  defaultEnvString,
  assertKafkaConfig,
  assertProvisioning,
  kafkaWithBrokerDefaults
} from './util'
import { KafkaConfig, KafkaConsumerConfig, KafkaProducerConfig } from './types'
import PRNG from '../../testing/prng'
import { deleteAtPath, enumeratePaths, replaceAtPath } from '../../testing/util'

describe('lib/config/util', () => {
  describe('assertString', () => {
    it('accepts a valid string', () => {
      assert.doesNotThrow(() => assertString('hello'))
      assert.doesNotThrow(() => assertString(''))
    })

    it('throws for non-string values', () => {
      assert.throws(() => assertString(123), /expected 'string', instead found number/)
      assert.throws(() => assertString(null), /expected 'string', instead found object/)
      assert.throws(() => assertString(undefined), /expected 'string', instead found undefined/)
      assert.throws(() => assertString({}), /expected 'string', instead found object/)
      assert.throws(() => assertString([]), /expected 'string', instead found object/)
      assert.throws(() => assertString(true), /expected 'string', instead found boolean/)
    })
  })

  describe('assertNumber', () => {
    it('accepts valid numbers', () => {
      assert.doesNotThrow(() => assertNumber(123))
      assert.doesNotThrow(() => assertNumber(0))
      assert.doesNotThrow(() => assertNumber(-42))
      assert.doesNotThrow(() => assertNumber(3.14))
    })

    it('throws for non-number values', () => {
      assert.throws(() => assertNumber('123'), /expected 'number', instead found string/)
      assert.throws(() => assertNumber(null), /expected 'number', instead found object/)
      assert.throws(() => assertNumber(undefined), /expected 'number', instead found undefined/)
      assert.throws(() => assertNumber({}), /expected 'number', instead found object/)
    })

    it('throws for NaN', () => {
      assert.throws(() => assertNumber(Number.NaN), /expected 'number', instead found NaN/)
    })
  })

  describe('assertBoolean', () => {
    it('accepts valid booleans', () => {
      assert.doesNotThrow(() => assertBoolean(true))
      assert.doesNotThrow(() => assertBoolean(false))
    })

    it('throws for non-boolean values', () => {
      assert.throws(() => assertBoolean('true'), /expected 'boolean', instead found string/)
      assert.throws(() => assertBoolean(1), /expected 'boolean', instead found number/)
      assert.throws(() => assertBoolean(0), /expected 'boolean', instead found number/)
      assert.throws(() => assertBoolean(null), /expected 'boolean', instead found object/)
      assert.throws(() => assertBoolean(undefined), /expected 'boolean', instead found undefined/)
    })
  })

  describe('assertStringOrNull', () => {
    it('accepts valid strings', () => {
      assert.doesNotThrow(() => assertStringOrNull('hello'))
      assert.doesNotThrow(() => assertStringOrNull(''))
    })

    it('accepts null', () => {
      assert.doesNotThrow(() => assertStringOrNull(null))
    })

    it('throws for non-string, non-null values', () => {
      assert.throws(() => assertStringOrNull(123), /expected 'string', instead found number/)
      assert.throws(() => assertStringOrNull(undefined), /expected 'string', instead found undefined/)
      assert.throws(() => assertStringOrNull({}), /expected 'string', instead found object/)
    })
  })

  describe('assertProxyCacheConfig', () => {
    it('accepts valid RedisClusterProxyCacheConfig', () => {
      assert.doesNotThrow(() => assertProxyCacheConfig({
        cluster: [{ host: 'redis', port: 8888 }]
      }))
      assert.doesNotThrow(() => assertProxyCacheConfig({
        cluster: [
          { host: 'redis-1', port: 8888 },
          { host: 'redis-2', port: 8888 },
        ]
      }))
      assert.doesNotThrow(() => assertProxyCacheConfig({
        username: 'redis_user',
        cluster: [
          { host: 'redis-1', port: 8888 },
          { host: 'redis-2', port: 8888 },
        ]
      }))
    })

    it('throws for invalid RedisClusterProxyCacheConfig', () => {
      assert.throws(() => assertProxyCacheConfig({
        cluster: []
      }))
      assert.throws(() => assertProxyCacheConfig({
        cluster: [
          { host: 'redis-1', port: 8888 },
          { host: 'redis-2', port: '8888' },
        ]
      }))
      assert.throws(() => assertProxyCacheConfig({
        username: 'redis_user',
        db: 'db',
        cluster: [
          { host: 'redis-1', port: 8888 },
          { host: 'redis-2', port: 8888 },
        ]
      }))
    })

    it('accepts valid RedisProxyCacheConfig', () => {
      assert.doesNotThrow(() => assertProxyCacheConfig({
        host: 'redis', port: 8000
      }))
      assert.doesNotThrow(() => assertProxyCacheConfig({
        host: 'redis', port: 8000, username: 'testing'
      }))
    })

    it('throws for invalid RedisProxyCacheConfig', () => {
      assert.throws(() => assertProxyCacheConfig({
        host: 'redis', port: '8000'
      }))
      assert.throws(() => assertProxyCacheConfig({
        host: 'redis', port: 8000, username: 1234
      }))
      assert.throws(() => assertProxyCacheConfig({
        host: 'redis', port: 8000, username: 'testing', lazyConnect: 'false'
      }))
      assert.throws(() => assertProxyCacheConfig({
        host: 'redis', port: 8000, username: 'testing', lazyConnect: false, db: '2'
      }))
    })

    it('accepts valid MySqlProxyCacheConfig', () => {
      assert.doesNotThrow(() => assertProxyCacheConfig({
        host: 'mysql', port: 8000
      }))
      assert.doesNotThrow(() => assertProxyCacheConfig({
        host: 'redis', port: 8000, user: 'testing'
      }))
    })

    it('throws for invalid MySqlProxyCacheConfig', () => {
      assert.throws(() => assertProxyCacheConfig({
        host: 'mysql',
      }))
      assert.throws(() => assertProxyCacheConfig({
        host: 'mysql', port: 8000, database: 12345
      }))
      assert.throws(() => assertProxyCacheConfig({
        host: 'mysql', port: 8000, user: 12345
      }))
    })
  })

  describe('defaultTo', () => {
    it('returns the input if defined', () => {
      assert.strictEqual(defaultTo('value', 'default'), 'value')
      assert.strictEqual(defaultTo(42, 0), 42)
      assert.strictEqual(defaultTo(false, true), false)
    })

    it('returns the default if input is undefined', () => {
      assert.strictEqual(defaultTo(undefined, 'default'), 'default')
      assert.strictEqual(defaultTo(undefined, 42), 42)
      assert.strictEqual(defaultTo(undefined, true), true)
    })

    it('throws if input type does not match default type', () => {
      assert.throws(() => defaultTo('string', 123))
      assert.throws(() => defaultTo(123, 'string'))
    })
  })

  describe('stringToBoolean', () => {
    it('converts `true` to true (case insensitive)', () => {
      assert.strictEqual(stringToBoolean('true'), true)
      assert.strictEqual(stringToBoolean('TRUE'), true)
      assert.strictEqual(stringToBoolean('True'), true)
    })

    it('converts `false` to false (case insensitive)', () => {
      assert.strictEqual(stringToBoolean('false'), false)
      assert.strictEqual(stringToBoolean('FALSE'), false)
      assert.strictEqual(stringToBoolean('False'), false)
    })

    it('throws for invalid input', () => {
      assert.throws(() => stringToBoolean('yes'), /unknown input/)
      assert.throws(() => stringToBoolean('no'), /unknown input/)
      assert.throws(() => stringToBoolean('1'), /unknown input/)
      assert.throws(() => stringToBoolean('0'), /unknown input/)
      assert.throws(() => stringToBoolean(''), /unknown input/)
    })
  })

  describe('convertBigIntToNumber', () => {
    it('converts bigint within safe range', () => {
      assert.strictEqual(convertBigIntToNumber(BigInt(123)), 123)
      assert.strictEqual(convertBigIntToNumber(BigInt(0)), 0)
      assert.strictEqual(convertBigIntToNumber(BigInt(-42)), -42)
      assert.strictEqual(convertBigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER)
      assert.strictEqual(convertBigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER)), Number.MIN_SAFE_INTEGER)
    })

    it('throws for bigint outside safe range', () => {
      assert.throws(
        () => convertBigIntToNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
        /input is outside of safe range/
      )
      assert.throws(
        () => convertBigIntToNumber(BigInt(Number.MIN_SAFE_INTEGER) - BigInt(1)),
        /input is outside of safe range/
      )
    })
  })

  describe('safeStringToNumber', () => {
    it('converts valid number strings', () => {
      assert.strictEqual(safeStringToNumber('123'), 123)
      assert.strictEqual(safeStringToNumber('0'), 0)
      assert.strictEqual(safeStringToNumber('-42'), -42)
      assert.strictEqual(safeStringToNumber('3.14'), 3.14)
      assert.strictEqual(safeStringToNumber('  123  '), 123)
    })

    it('throws for invalid number strings', () => {
      assert.throws(() => safeStringToNumber(''), /Invalid number string/)
      assert.throws(() => safeStringToNumber('abc'), /Invalid number string/)
      assert.throws(() => safeStringToNumber('12abc'), /Invalid number string/)
      assert.throws(() => safeStringToNumber('   '), /Invalid number string/)
    })

    it('throws for infinity', () => {
      assert.throws(() => safeStringToNumber('Infinity'), /Number out of range/)
      assert.throws(() => safeStringToNumber('-Infinity'), /Number out of range/)
    })
  })

  describe('assertRange', () => {
    it('accepts numbers within range', () => {
      assert.doesNotThrow(() => assertRange(5, 0, 10))
      assert.doesNotThrow(() => assertRange(0, 0, 10))
      assert.doesNotThrow(() => assertRange(10, 0, 10))
      assert.doesNotThrow(() => assertRange(-5, -10, 0))
    })

    it('throws for numbers outside range', () => {
      assert.throws(() => assertRange(-1, 0, 10), /valid range/)
      assert.throws(() => assertRange(11, 0, 10), /valid range/)
    })

    it('throws for non-numbers', () => {
      assert.throws(() => assertRange('5' as any, 0, 10))
    })

    it('throws for invalid range arguments', () => {
      assert.throws(() => assertRange(5, 10, 0), /expected maxInclusive > minInclusive/)
    })
  })

  describe('assertNestedFields', () => {
    it('passes for existing top-level field', () => {
      const config = { DATABASE: { HOST: 'localhost' } }
      assert.doesNotThrow(() => assertNestedFields(config, 'DATABASE'))
    })

    it('passes for existing nested fields', () => {
      const config = {
        HANDLERS: {
          API: {
            DISABLED: false
          }
        }
      }
      assert.doesNotThrow(() => assertNestedFields(config, 'HANDLERS'))
      assert.doesNotThrow(() => assertNestedFields(config, 'HANDLERS.API'))
      assert.doesNotThrow(() => assertNestedFields(config, 'HANDLERS.API.DISABLED'))
    })

    it('throws for missing top-level field', () => {
      const config = { DATABASE: {} }
      assert.throws(() => assertNestedFields(config, 'MISSING'), /expected `MISSING` to be defined/)
    })

    it('throws for missing nested field', () => {
      const config = { HANDLERS: {} }
      assert.throws(() => assertNestedFields(config, 'HANDLERS.API'), /expected `HANDLERS.API` to be defined/)
    })

    it('throws for deeply missing nested field', () => {
      const config = { HANDLERS: { API: {} } }
      assert.throws(
        () => assertNestedFields(config, 'HANDLERS.API.MISSING'),
        /expected `HANDLERS.API.MISSING` to be defined/
      )
    })
  })

  describe('assertKafkaConfig', () => {
    const prng = new PRNG(100)

    it('passes for a valid kafka config', () => {
      // Base config is valid.
      const valid = makeBaseConfig()

      assert.doesNotThrow(() => assertKafkaConfig(valid))
    })

    /**
     * Fuzz test for Kafka Config.
     * Mutates the Kafka Config and checks if it remains valid.
     */
    type MutationOption = 'DELETE_ELEMENT' | 'MUTATE_ACTION_TOPIC_MAP'
    const mutationOptions: Record<string, number> = {
      'DELETE_ELEMENT': 5,
      'MUTATE_ACTION_TOPIC_MAP': 1
    }
    const weightedMutationOptions = Object.keys(mutationOptions).reduce((acc, curr: string) => {
      const occurrences = mutationOptions[curr]
      acc = acc.concat(new Array(occurrences).fill((curr as unknown as MutationOption), 0, occurrences))
      return acc
    }, [] as Array<MutationOption>)

    const mutateConfigKafka = (input: any, times: number): [any, 'FAIL' | 'PASS'] => {
      assert(times > 0, 'Expected times to be a positive integer')
      // By default we expect to start with a valid config.
      let expectPassOrFail: 'FAIL' | 'PASS' = 'PASS' as unknown as 'FAIL' | 'PASS'
      const mutatablePaths = enumeratePaths(input).filter(path =>
        path.match(/EVENT_TYPE_ACTION_TOPIC_MAP\|POSITION\|/)
      )

      const _handleDeleteElement = (input: any): void => {
        const paths = enumeratePaths(input)
        const path = prng.randomElementFrom(paths)

        // Mark this path as uneligible to be mutated.
        const idxPath = mutatablePaths.indexOf(path)
        if (idxPath >= 0) {
          mutatablePaths.splice(idxPath, 1)
        }

        deleteAtPath(input, path)

        // Once it's failed, it can't be saved.
        if (expectPassOrFail === 'FAIL') return

        // Non fatal - final leaf nodes on the consumer or producer options.
        if (path.match(/config\|(options|rdkafkaConf|topicConf)\|(.*)/)) return

        const elements = path.split('|')
        if (elements.length >= 1 && elements.length <= 5) {
          expectPassOrFail = 'FAIL'
        }
      }

      const _handleMutateActionTopicMap = (input: any): void => {
        if (!input.EVENT_TYPE_ACTION_TOPIC_MAP || !input.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION) {
          // We can't mutate these fields, they've been deleted.
          return
        }
        if (mutatablePaths.length === 0) return

        const path = prng.randomElementFrom(mutatablePaths)

        // Make sure this path doesn't get mutated again by removing from the array.
        const idxPath = mutatablePaths.indexOf(path)
        assert(idxPath >= 0)
        mutatablePaths.splice(idxPath, 1)

        const newValue = prng.randomElementFrom([null, 'test-string', undefined, 1323])
        replaceAtPath(input, path, newValue)

        if (expectPassOrFail === 'FAIL') return

        // Null or string values are valid.
        if (newValue === null || newValue === 'test-string') return

        expectPassOrFail = 'FAIL'
      }

      const _mutateConfig = (input: any): any => {
        const choice = prng.randomElementFrom(weightedMutationOptions)

        switch (choice) {
          case 'DELETE_ELEMENT':
            _handleDeleteElement(input)
            break
          case 'MUTATE_ACTION_TOPIC_MAP':
            _handleMutateActionTopicMap(input)
            break
        }

        return input
      }

      for (let idx = times; idx >= 0; idx--) {
        input = _mutateConfig(input)
      }
      return [input, expectPassOrFail]
    }

    it('fuzz: fails for an invalid kafka config', () => {
      const ITERATIONS = 100
      for (let idx = 0; idx < ITERATIONS; idx++) {
        const baseConfig = makeBaseConfig()
        const [mutated, expectPassOrFail] = mutateConfigKafka(baseConfig, 5)
        switch (expectPassOrFail) {
          // Mutation has made config invalid.
          case 'FAIL': {
            assert.throws(
              () => assertKafkaConfig(mutated), 
              `Expected mutated kafka config to fail validation: (iteration: ${idx}).\n\
              ${JSON.stringify(mutated, null, 2)}`
            )
            break
          }
          // Mutation hasn't made config invalid.
          case 'PASS': {
            assert.doesNotThrow(
              () => assertKafkaConfig(mutated),
              `Expected mutated kafka config to pass validation: (iteration: ${idx}).\n\
              ${JSON.stringify(mutated, null, 2)}`
            )
          }
        }
      }
    })
  })

  describe('kafkaWithBrokerDefaults', () => {
    it('overrides the broker defaults', () => {
      // Arrange
      const base = makeBaseConfig()

      // Delete some of these so they get overriden.
      deleteAtPath(base, 'CONSUMER|BULK|PREPARE|config|rdkafkaConf|metadata.broker.list')
      deleteAtPath(base, 'CONSUMER|TRANSFER|PREPARE|config|rdkafkaConf|metadata.broker.list')
      deleteAtPath(base, 'CONSUMER|ADMIN|TRANSFER|config|rdkafkaConf|metadata.broker.list')

      // Act
      const overriden = kafkaWithBrokerDefaults(base, 'testing-1234')

      // Assert

      // Modified fields:
      assert.strictEqual(
        overriden.CONSUMER.BULK.PREPARE.config.rdkafkaConf['metadata.broker.list'], 
        'testing-1234'
      )
      assert.strictEqual(
        overriden.CONSUMER.TRANSFER.PREPARE.config.rdkafkaConf['metadata.broker.list'], 
        'testing-1234'
      )
      assert.strictEqual(
        overriden.CONSUMER.ADMIN.TRANSFER.config.rdkafkaConf['metadata.broker.list'], 
        'testing-1234'
      )

      // Unmodified fields:
      assert.strictEqual(
        overriden.PRODUCER.ADMIN.TRANSFER.config.rdkafkaConf['metadata.broker.list'], 
        'localhost:9092'
      )
    })
  })

  describe('assertProvisioning', () => {
    it('passes for a valid config', () => {
      assert.doesNotThrow(() => assertProvisioning({
        enabled: true,
        currencies: ['KES']
      }))
      assert.doesNotThrow(() => assertProvisioning({
        enabled: true, currencies: ['KES']
      }))
      assert.doesNotThrow(() => assertProvisioning({
        enabled: false, currencies: []
      }))
      assert.doesNotThrow(() => assertProvisioning({
        enabled: true, currencies: ['ABC'], hubAlertEmailAddress: 'test_email'
      }))
    })

    it('fails for invalid config', () => {
      assert.throws(() => assertProvisioning(undefined as unknown))
      assert.throws(() => assertProvisioning({
        enabled: undefined,
        currencies: ['KES']
      }))
      assert.throws(() => assertProvisioning({
        enabled: true, currencies: []
      }))
      assert.throws(() => assertProvisioning({
        enabled: true, currencies: [1234]
      }))
      assert.throws(() => assertProvisioning({
        enabled: true, currencies: ['ABC'], hubAlertEmailAddress: 12345
      }))
    })
  })

  describe('defaultEnvString', () => {
    it('handles a default value of `false`', () => {
      const result = defaultEnvString({}, 'LOG_ENABLED', 'false')
      assert.strictEqual(result, 'false')

      assert.strictEqual(
        defaultEnvString({ LOG_ENABLED: 'true' }, 'LOG_ENABLED', 'false'),
        'true'
      )

      assert.strictEqual(
        defaultEnvString({ LEDGER: ['TIGERBEETLE'] } as unknown as NodeJS.ProcessEnv, 'LEDGER', 'false'),
        'TIGERBEETLE'
      )

      assert.strictEqual(
        defaultEnvString({ LOG_ENABLED: undefined }, 'LOG_ENABLED', 'false'),
        'false'
      )

      assert.strictEqual(
        defaultEnvString({ LEDGER: [undefined] } as unknown as NodeJS.ProcessEnv, 'LEDGER', 'MYSQL'),
        'MYSQL'
      )
    })

    it('throws on invalid input', () => {
      assert.throws(() => defaultEnvString(undefined as unknown as NodeJS.ProcessEnv, 'LOG_ENABLED', 'false'))
      assert.throws(() => defaultEnvString({}, false as unknown as string, 'false'))
      assert.throws(() => defaultEnvString({}, undefined as unknown as string, 'false'))
      assert.throws(() => defaultEnvString({}, undefined as unknown as string, 'false'))
      assert.throws(() => defaultEnvString({}, 'LOG_ENABLED', undefined as unknown as string))
      assert.throws(() => defaultEnvString({}, 'LOG_ENABLED', {} as unknown as string))
    })
  })
})

const makeBaseConfig = (): KafkaConfig => {
  return {
    EVENT_TYPE_ACTION_TOPIC_MAP: {
      POSITION: {
        PREPARE: null,
        FX_PREPARE: 'topic-transfer-position-batch',
        BULK_PREPARE: null,
        COMMIT: null,
        BULK_COMMIT: null,
        RESERVE: null,
        FX_RESERVE: 'topic-transfer-position-batch',
        TIMEOUT_RESERVED: null,
        FX_TIMEOUT_RESERVED: 'topic-transfer-position-batch',
        ABORT: null,
        FX_ABORT: 'topic-transfer-position-batch'
      }
    },
    TOPIC_TEMPLATES: {
      PARTICIPANT_TOPIC_TEMPLATE: {
        TEMPLATE: 'topic-{{participantName}}-{{functionality}}-{{action}}',
        REGEX: 'topic-(.*)-(.*)-(.*)'
      },
      GENERAL_TOPIC_TEMPLATE: {
        TEMPLATE: 'topic-{{functionality}}-{{action}}',
        REGEX: 'topic-(.*)-(.*)'
      }
    },
    CONSUMER: {
      BULK: {
        PREPARE: generateValidConsumer(),
        PROCESSING: generateValidConsumer(),
        FULFIL: generateValidConsumer(),
        GET: generateValidConsumer(),
      },
      TRANSFER: {
        PREPARE: generateValidConsumer(),
        GET: generateValidConsumer(),
        FULFIL: generateValidConsumer(),
        POSITION: generateValidConsumer(),
        POSITION_BATCH: generateValidConsumer(),
      },
      ADMIN: {
        TRANSFER: generateValidConsumer()
      },
      NOTIFICATION: {
        EVENT: generateValidConsumer()
      }
    },
    PRODUCER: {
      BULK: {
        PROCESSING: generateValidProducer()
      },
      TRANSFER: {
        PREPARE: generateValidProducer(),
        FULFIL: generateValidProducer(),
        POSITION: generateValidProducer(),
      },
      NOTIFICATION: {
        EVENT: generateValidProducer(),
      },
      ADMIN: {
        TRANSFER: generateValidProducer(),
      }
    }
  }
}

const generateValidConsumer = (): KafkaConsumerConfig => {
  return {
    config: {
      options: {
        mode: 2,
        batchSize: 1,
        pollFrequency: 10,
        recursiveTimeout: 100,
        messageCharset: 'utf8',
        messageAsJSON: true,
        sync: true,
        consumeTimeout: 1000
      },
      rdkafkaConf: {
        'client.id': 'test-client-id',
        'group.id': 'test-group-id',
        'metadata.broker.list': 'localhost:9092',
        'socket.keepalive.enable': true,
        'allow.auto.create.topics': true
      },
      topicConf: {
        'auto.offset.reset': 'earliest'
      }
    }
  }
}

const generateValidProducer = (): KafkaProducerConfig => {
  return {
    config: {
      options: {
        messageCharset: 'utf8'
      },
      rdkafkaConf: {
        'metadata.broker.list': 'localhost:9092',
        'client.id': 'test-client-id',
        'event_cb': true,
        'dr_cb': true,
        'socket.keepalive.enable': true,
        'queue.buffering.max.messages': 10000000
      },
      topicConf: {
        'request.required.acks': 'all',
        'partitioner': 'murmur2_random'
      }
    }
  }
}