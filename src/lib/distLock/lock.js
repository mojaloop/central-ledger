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

/**
 * @interface LockInterface
 * @property {Function} acquire - Method to acquire a lock.
 * @property {Function} release - Method to release a lock.
 * @property {Function} extend - Method to extend a lock.
 */

class LockInterface {
  /**
   * @constructor
   * @param {Object} config - Configuration for the lock implementation.
   * @param {Object} logger - Logger instance for logging.
   */
  constructor (config, logger) {
    if (new.target === LockInterface) {
      throw new TypeError('Cannot construct LockInterface instances directly')
    }
    validateInterface(this)
  }

  /**
   * @method acquire
   * @param {string} key - The key to acquire the lock for.
   * @param {number} ttl - Time to live for the lock.
   * @param {number} acquireTimeout - Timeout for acquiring the lock.
   */
  /* istanbul ignore next */
  acquire (key, ttl, acquireTimeout) {
    throw new Error('Method "acquire" must be implemented')
  }

  /**
   * @method release
   */
  /* istanbul ignore next */
  release () {
    throw new Error('Method "release" must be implemented')
  }

  /**
   * @method extend
   * @param {number} ttl - New time to live for the lock.
   */
  /* istanbul ignore next */
  extend (ttl) {
    throw new Error('Method "extend" must be implemented')
  }
}

function getClassMethodsFromClass (Class) {
  const prototype = Class.prototype
  return Object.getOwnPropertyNames(prototype).filter(
    (prop) =>
      typeof prototype[prop] === 'function' &&
      prop !== 'constructor'
  )
}

function hasOwnMethod (instance, methodName) {
  const prototype = Object.getPrototypeOf(instance)
  return (
    Object.getOwnPropertyNames(prototype).includes(methodName) &&
    typeof prototype[methodName] === 'function'
  )
}

function validateInterface (instance) {
  const methods = getClassMethodsFromClass(LockInterface)
  methods.forEach((method) => {
    if (!hasOwnMethod(instance, method)) {
      throw new Error(`Class must implement method: "${method}"`)
    }
  })
}

module.exports = LockInterface
