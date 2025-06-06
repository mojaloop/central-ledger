/**
 * @interface LockInterface
 * @property {Function} acquire - Method to acquire a lock.
 * @property {Function} release - Method to release a lock.
 * @property {Function} extend - Method to extend a lock.
 */

class LockInterface {
  constructor (config, logger) {
    if (new.target === LockInterface) {
      throw new TypeError('Cannot construct LockInterface instances directly')
    }
    validateInterface(this)
  }

  acquire (key, ttl, acquireTimeout) {
    throw new Error('Method "acquire" must be implemented')
  }

  release () {
    throw new Error('Method "release" must be implemented')
  }

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
      throw new Error(`Class must implement method: ${method}`)
    }
  })
}

module.exports = LockInterface
