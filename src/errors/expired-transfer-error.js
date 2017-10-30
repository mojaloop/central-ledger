'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ExpiredTransferError extends BaseError {
  constructor () {
    super(ErrorCategory.INTERNAL, 'The provided entity is syntactically correct, but there is a generic semantic problem with it.')
  }
}

module.exports = ExpiredTransferError
