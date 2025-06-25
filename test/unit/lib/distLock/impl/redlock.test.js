/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Infitx
 - Steven Oderayi <steven.oderayi@infitx.com>

 --------------

 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const sinon = require('sinon')
const Proxyquire = require('proxyquire')
const { mockRedis, mockRedlock, mockConfig, mockLogger } = require('../mocks')
// todo: rename file back after resolving an issue with missed ../mocks
const { ERROR_MESSAGES } = require('../../../../../src/lib/distLock/constants')

Test('DistributedLock', async (distLockTest) => {
  let DistributedLock

  distLockTest.beforeEach((t) => {
    DistributedLock = Proxyquire('../../../../../src/lib/distLock/impl/redlock', {
      ioredis: mockRedis,
      redlock: { default: mockRedlock }
    })
    t.end()
  })

  distLockTest.test('createLock', async (t) => {
    t.test('should create a new DistributedLock instance', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      t.ok(lock, 'Lock instance should be created')
      t.end()
    })
    t.test('should create a new DistributedLock with redis-cluster config', async (t) => {
      const minConfig = {
        redisConfigs: [{ type: 'redis-cluster', cluster: [{ host: 'localhost', port: 6379 }] }]
      }
      const lock = DistributedLock.createLock(minConfig, mockLogger)
      t.ok(lock, 'Lock instance with redis-cluster config should be created')
      t.end()
    })
    t.test('should create a new DistributedLock with defaults', async (t) => {
      const minConfig = {
        redisConfigs: [{ type: 'redis', host: 'localhost', port: 6379 }]
      }
      const lock = DistributedLock.createLock(minConfig, mockLogger)
      t.ok(lock, 'Lock instance with default config should be created')
      t.end()
    })
    t.test('should throw error for invalid config', async (t) => {
      const invalidConfig = { redisConfigs: 'invalid' }
      t.throws(() => DistributedLock.createLock(invalidConfig, mockLogger), /Invalid configuration/, 'Should throw error for invalid config')
      t.end()
    })
    t.end()
  })

  distLockTest.test('acquire', async (t) => {
    t.test('should acquire lock successfully', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      const result = await lock.acquire('test-key', 1000)
      t.equal(result, 'test-lock-value', 'Should return lock value')
      t.end()
    })
    t.test('should throw error on acquire timeout', async (t) => {
      const mockRedlockMod = sinon.stub().returns({
        acquire: async () => {
          await new Promise(resolve => setTimeout(resolve, 6000))
          return { value: 'test-lock-value' }
        },
        on: () => {}
      })
      DistributedLock = Proxyquire('../../../../../src/lib/distLock/impl/redlock', {
        ioredis: mockRedis,
        redlock: { default: mockRedlockMod }
      })
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      try {
        await lock.acquire('test-key', 1000)
        t.fail('Should throw timeout error')
      } catch (error) {
        t.equal(error.message, ERROR_MESSAGES.TIMEOUT_ERROR, 'Should throw timeout error')
      }
      t.end()
    })

    t.test('should throw error when lock cannot be acquired', async (t) => {
      const mockRedlockMod = sinon.stub().returns({
        acquire: async () => null,
        on: () => {}
      })
      DistributedLock = Proxyquire('../../../../../src/lib/distLock/impl/redlock', {
        ioredis: mockRedis,
        redlock: { default: mockRedlockMod }
      })
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      try {
        await lock.acquire('test-key', 1000)
        t.fail('Should throw error when lock cannot be acquired')
      } catch (error) {
        t.equal(error.message, ERROR_MESSAGES.ACQUIRE_ERROR, 'Should throw error when lock cannot be acquired')
      }
      t.end()
    })
    t.end()
  })

  distLockTest.test('release', async (t) => {
    t.test('should release lock successfully', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      await lock.acquire('test-key', 1000)
      const result = await lock.release()
      t.true(result, 'Should return true on successful release')
      t.end()
    })
    t.test('should throw error when no lock to release', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      try {
        await lock.release()
        t.fail('Should throw error when no lock exists')
      } catch (error) {
        t.equal(error.message, ERROR_MESSAGES.NO_LOCK_TO_RELEASE, 'Should throw error when no lock exists')
      }
      t.end()
    })
    t.end()
  })

  distLockTest.test('extend', async (t) => {
    t.test('should extend lock successfully', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      await lock.acquire('test-key', 1000)
      const result = await lock.extend(2000)
      t.equal(result, 'test-lock-extend-value', 'Should return lock value after extension')
      t.end()
    })
    t.test('should throw error when no lock to extend', async (t) => {
      const lock = DistributedLock.createLock(mockConfig, mockLogger)
      try {
        await lock.extend(2000)
        t.fail('Should throw error when no lock exists')
      } catch (error) {
        t.equal(error.message, ERROR_MESSAGES.NO_LOCK_TO_EXTEND, 'Should throw error when no lock exists')
      }
      t.end()
    })
    t.end()
  })

  distLockTest.test('error handling', async (t) => {
    t.test('should handle redlock errors', async (t) => {
      let errorLogged = false
      const errorLogger = {
        debug: () => { errorLogged = true },
        verbose: () => {},
        error: () => {},
        child: () => errorLogger
      }
      const mockRedlockMod = sinon.stub().returns({
        on: (event, handler) => {
          if (event === 'error') {
            handler(new Error('Test error'))
          }
        }
      })
      DistributedLock = Proxyquire('../../../../../src/lib/distLock/impl/redlock', {
        ioredis: mockRedis,
        redlock: { default: mockRedlockMod }
      })
      DistributedLock.createLock(mockConfig, errorLogger)
      t.true(errorLogged, 'Should log error')
      t.end()
    })
    t.end()
  })

  distLockTest.end()
})
