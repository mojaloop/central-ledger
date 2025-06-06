/**
 * @interface LockInterface
 * @property {Function} acquire - Method to acquire a lock.
 * @property {Function} release - Method to release a lock.
 * @property {Function} extend - Method to extend a lock.
 */

class LockInterface {
  acquire () {
    throw new Error('Method "acquire" must be implemented')
  }

  release () {
    throw new Error('Method "release" must be implemented')
  }

  extend () {
    throw new Error('Method "extend" must be implemented')
  }

  getLock () {
    throw new Error('Method "getLock" must be implemented')
  }
}

function getClassMethods (instance) {
  const prototype = Object.getPrototypeOf(instance)
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
  const methods = getClassMethods(new LockInterface())
  methods.forEach((method) => {
    if (!hasOwnMethod(instance, method)) {
      throw new Error(`Class must implement method: ${method}`)
    }
  })
}

module.exports = {
  LockInterface,
  validateInterface
}
