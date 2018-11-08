'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class hubOperatorAccountTypeError extends BaseError {
  constructor (message = 'The requested hub operator account type is not allowed.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = hubOperatorAccountTypeError
