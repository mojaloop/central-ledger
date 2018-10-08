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

module.exports = {
  validateCondition
}
