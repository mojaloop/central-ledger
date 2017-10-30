'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class UnpreparedTransferError extends BaseError {
  constructor () {
    super(ErrorCategory.UNPROCESSABLE, 'The provided entity is syntactically correct, but there is a generic semantic problem with it.')
  }
}

module.exports = UnpreparedTransferError
