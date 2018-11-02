'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class HubAccountExistsError extends BaseError {
  constructor (message = 'Hub account has already been registered.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = HubAccountExistsError
