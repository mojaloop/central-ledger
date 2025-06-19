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

const Redis = require('ioredis')
const { default: Redlock } = require('redlock')
const { logger: defaultLogger } = require('../../../shared/logger')
const LockInterface = require('../lock')
const { ERROR_MESSAGES, REDIS_TYPE } = require('../constants')

// @todo Move to shared library once stable

/**
 * @typedef {Object} DistributedLockConfig
 * @property {Array<Object>} redisConfigs - Array of Redis instance configurations.
 * @property {string} redisConfigs[].type - Type of Redis instance ('redis' or 'redis-cluster').
 * @property {string} redisConfigs[].host - Hostname of a standalone Redis instance when type is "redis".
 * @property {number} redisConfigs[].port - Port of a standalone Redis instance when type is "redis".
 * @property {number} redisConfigs[].cluster - Array of Redis leader nodes for cluster configuration when type is "redis-cluster".
 * @property {string} redisConfigs[].cluster[].host - Hostname of the Redis leader node in a cluster.
 * @property {number} redisConfigs[].cluster[].port - Port of a the Redis leader node in a cluster.
 * @property {number} [driftFactor=0.01] - Drift factor for Redlock.
 * @property {number} [retryCount=3] - Number of retry attempts for acquiring a lock.
 * @property {number} [retryDelay=200] - Delay in milliseconds between retry attempts.
 * @property {number} [retryJitter=100] - Jitter in milliseconds for retry delay.
 * @property {number} [lockTimeout=10000] - Time-to-live for the lock in milliseconds.
 *
 */

/**
 * DistributedLock class provides a distributed locking mechanism using Redlock.
 * It supports both Redis standalone and Redis Cluster configurations simultaneously.
 * It allows acquiring, releasing, and extending locks across multiple Redis instances.
 *
 * @class DistributedLock
 * @param {DistributedLockConfig} config - Configuration for the distributed lock.
 * @param {Object} [logger=console] - Logger instance for logging messages.
 */
class DistributedLock extends LockInterface {
  #redlock = null
  #lock = null
  #timeout = null

  constructor (config, logger) {
    super()
    this.config = config
    this.logger = (logger || defaultLogger).child({ component: this.constructor.name })
    this.redisInstances = config.redisConfigs.map(instance => this.#createRedisClient(instance))
    this.#redlock = new Redlock(this.redisInstances, {
      driftFactor: config.driftFactor || 0.01,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 200,
      retryJitter: config.retryJitter || 100
    })
    this.#redlock.on('error', this.#handleError.bind(this))
  }

  async acquire (key, ttl, aqcuireTimeout = 5000) {
    let timeoutError
    const timeoutPromise = new Promise((_resolve, reject) => {
      const timeout = setTimeout(() => {
        timeoutError = new Error(ERROR_MESSAGES.TIMEOUT_ERROR)
        reject(timeoutError)
      }, aqcuireTimeout)
      this.#timeout = timeout // Store timeout reference to clear it later
    })

    try {
      this.#lock = await Promise.race([
        this.#redlock.acquire([key], ttl),
        timeoutPromise
      ])
      clearTimeout(this.#timeout) // Clear timeout if lock is acquired
      if (!this.#lock) {
        throw new Error(ERROR_MESSAGES.ACQUIRE_ERROR)
      }
      this.logger.debug(`Lock acquired: ${this.#lock.value} with TTL: ${ttl}ms`)
      return this.#lock.value
    } catch (error) {
      if (error === timeoutError) {
        this.logger.error(error.stack) // Possible redis connection issue, cluster not correctly setup etc.
      }
      throw error // Re-throw the error for the caller to handle
    }
  }

  async release () {
    if (!this.#lock) {
      throw new Error(ERROR_MESSAGES.NO_LOCK_TO_RELEASE)
    }
    await this.#redlock.release(this.#lock)
    this.logger.debug(`Lock released: ${this.#lock.value}`)
    this.#lock = null
    return true
  }

  async extend (ttl) {
    if (!this.#lock) {
      throw new Error(ERROR_MESSAGES.NO_LOCK_TO_EXTEND)
    }
    this.#lock = await this.#redlock.extend(this.#lock, ttl)
    this.logger.debug(`Lock extended: ${this.#lock.value} with new TTL: ${ttl}ms`)
    return this.#lock.value
  }

  #createRedisClient (instance) {
    return instance.type === REDIS_TYPE.REDIS_CLUSTER
      ? new Redis.Cluster(instance.cluster)
      : new Redis(instance)
  }

  #handleError (error) {
    // Logging with debug level as all redlock methods throw on all failures anyway.
    // The error here is only more specific for fixing technical issues.
    this.logger.debug(ERROR_MESSAGES.REDLOCK_ERROR, error)
  }
}

const createLock = (config, logger) => {
  if (!Array.isArray(config?.redisConfigs)) {
    throw new Error(ERROR_MESSAGES.INVALID_CONFIG)
  }
  const distLock = new DistributedLock(config, logger)
  return distLock
}

module.exports = { createLock }
