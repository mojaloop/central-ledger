'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class AccountReservedForHubOperatorError extends BaseError {
  constructor (message = 'Account type is reserved for Hub Operator.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = AccountReservedForHubOperatorError
