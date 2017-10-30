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

const validateFulfillment = (fulfillment, condition) => {
  try {
    const fulfillmentCondition = FiveBellsCondition.fulfillmentToCondition(fulfillment)
    if (fulfillmentCondition === condition) {
      return FiveBellsCondition.validateFulfillment(fulfillment, condition)
    }
  } catch (error) {
    throw new Errors.InvalidBodyError(`Invalid fulfillment: ${error.message}`)
  }
  throw new Errors.UnmetConditionError()
}

module.exports = {
  validateCondition,
  validateFulfillment
}
