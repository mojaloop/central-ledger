'use strict'

const FiveBellsCondition = require('five-bells-condition')
const Errors = require('../errors')

const validateCondition = (conditionUri) => {
  try {
    return FiveBellsCondition.validateCondition(conditionUri)
  } catch (error) {
    throw new Errors.ValidationError(error.message)
  }
}

const validateFulfillment = (fulfilment, condition) => {
  try {
    const fulfillmentCondition = FiveBellsCondition.fulfillmentToCondition(fulfilment)
    if (fulfillmentCondition === condition) {
      return FiveBellsCondition.validateFulfillment(fulfilment, condition)
    }
  } catch (error) {
    throw new Errors.InvalidBodyError(`Invalid fulfilment: ${error.message}`)
  }
  throw new Errors.UnmetConditionError()
}

module.exports = {
  validateCondition,
  validateFulfillment
}
