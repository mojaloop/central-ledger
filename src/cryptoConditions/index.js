'use strict'

const FiveBellsCondition = require('five-bells-condition')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const validateCondition = (conditionUri) => {
  try {
    return FiveBellsCondition.validateCondition(conditionUri)
  } catch (err) {
    const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
    throw fspiopError
  }
}

module.exports = {
  validateCondition
}
