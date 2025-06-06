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
const { RedlockMutex: Redlock } = require('redis-semaphore')
const { ERROR_MESSGAES } = require('./constants')

// @todo Move to shared library once stable
// @todo determine which errors should be added to metrics and/or worth rethrowing

/**
 * @typedef {Object} DistributedLockConfig
 * @property {Object} redisConfig - Configuration for Redis instances.
 * @property {Array<Object>} redisConfig.instances - Array of Redis instance configurations.
 * @property {string} redisConfig.instances[].type - Type of Redis instance ('redis' or 'redis-cluster').
 * @property {string} redisConfig.instances[].host - Hostname of a standalone Redis instance when type is "redis".
 * @property {number} redisConfig.instances[].port - Port of a standalone Redis instance when type is "redis".
 * @property {Object} redisConfig.instances[].cluster - Cluster configuration for Redis Cluster instances.
 * @property {number} redisConfig.instances[].cluster.nodes - Array of Redis nodes for cluster configuration.
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
 */
class DistributedLock {
  constructor (config, logger) {
    this.lock = null
    this.config = config
    this.logger = logger || console
    this.redisInstances = config.redisConfig.instances.map(instance => this.createRedisClient(instance))
    this.redlock = new Redlock(this.redisInstances.map(instance => instance.nodes), {
      driftFactor: config.driftFactor || 0.01,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 200,
      retryJitter: config.retryJitter || 100
    })
    this.redlock.on('error', this.handleError.bind(this))
  }

  createRedisClient (instance) {
    return instance.type === 'redis-cluster'
      ? new Redis.Cluster(instance.cluster)
      : new new Redis(instance)()
  }

  async acquireLock (key, ttl) {
    this.lock = await this.redlock.acquire([key], ttl)
    if (!this.lock) {
      throw new Error(ERROR_MESSGAES.ACQUIRE_ERROR)
    }
    this.logger.info(`Lock acquired: ${this.lock.value} with TTL: ${ttl}ms`)
    return this.lock.value
  }

  async releaseLock () {
    if (!this.lock) {
      throw new Error(ERROR_MESSGAES.NO_LOCK_TO_RELEASE)
    }
    await this.redlock.release()
    this.logger.info(`Lock released: ${this.lock.value}`)
    this.lock = null
    return true
  }

  async extendLock (ttl) {
    if (!this.lock) {
      throw new Error(ERROR_MESSGAES.NO_LOCK_TO_EXTEND)
    }
    this.lock = await this.redlock.extend(ttl)
    this.logger.info(`Lock extended: ${this.lock.value} with new TTL: ${ttl}ms`)
    return this.lock.value
  }

  async getLock () {
    return this.lock
  }

  handleError (error) {
    this.logger.error(ERROR_MESSGAES.REDLOCK_ERROR, error)
  }
}

const createDistLock = (config, logger) => {
  if (!config || !config.redisConfig || !Array.isArray(config.redisConfig.instances)) {
    throw new Error(ERROR_MESSGAES.INVALID_CONFIG)
  }

  return new DistributedLock(config, logger)
}

module.exports = { createDistLock }
