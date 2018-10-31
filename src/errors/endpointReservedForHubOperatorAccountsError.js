'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class EndpointReservedForHubOperatorAccountsError extends BaseError {
  constructor (message = 'Endpoint is reserved for creation of Hub account types only.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = EndpointReservedForHubOperatorAccountsError
