'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')

/**
 * @function validateCondition
 * @description Validate that the condition is a valid 32-byte base64 encoded string.
 *
 * Reference: https://docs.mojaloop.io/api/fspiop/v1.1/api-definition.html#conditional-transfers
 *
 * ILP supports a variety of conditions for performing a conditional payment, but implementers of
 * the API should use the SHA-256 hash of a 32-byte pre-image. The condition attached to the transfer
 * is the SHA-256 hash and the fulfilment of that condition is the pre-image. Therefore, if the
 * condition attached to a transfer is a SHA-256 hash, then when a fulfilment is submitted for
 * that transaction, the ledger will validate it by calculating the SHA-256 hash of the fulfilment
 * and ensuring that the hash is equal to the condition.
 */
const validateCondition = (condition) => {
  try {
    if (!condition) {
      throw new Error('Condition not defined.')
    }

    const conditionBuffer = Buffer.from(condition, 'base64')
    if (conditionBuffer.length !== 32) {
      throw new Error(`Expected condition to have length of 32, found: ${conditionBuffer.length}.`)
    }

    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  validateCondition
}
