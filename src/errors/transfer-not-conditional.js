'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class TransferNotConditionalError extends BaseError {
  constructor (message = 'Transfer is not conditional') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = TransferNotConditionalError
