'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ValidationError extends BaseError {
  constructor (message) {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = ValidationError
