'use strict'

const FiveBellsCondition = require('five-bells-condition')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const validateCondition = (conditionUri) => {
  try {
    return FiveBellsCondition.validateCondition(conditionUri)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  validateCondition
}
