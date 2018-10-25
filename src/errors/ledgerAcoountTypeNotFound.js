'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class LedgerAccountTypeNotFoundError extends BaseError {
  constructor (message = 'Ledger account type was not found.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = LedgerAccountTypeNotFoundError
