'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class hubReconciliationAccountNotFound extends BaseError {
  constructor (message = 'Hub reconciliation account for the specified currency does not exist') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = hubReconciliationAccountNotFound
