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

const validateFulfilment = (fulfilment, condition) => {
  try {
    const fulfilmentCondition = FiveBellsCondition.fulfillmentToCondition(fulfilment)
    if (fulfilmentCondition === condition) {
      return FiveBellsCondition.validateFulfillment(fulfilment, condition)
    }
  } catch (error) {
    throw new Errors.InvalidBodyError(`Invalid fulfilment: ${error.message}`)
  }
  throw new Errors.UnmetConditionError()
}

module.exports = {
  validateCondition,
  validateFulfilment
}
