'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class hubMlnsAccountNotFound extends BaseError {
  constructor (message = 'Hub multilateral net settlement account for the specified currency does not exist') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = hubMlnsAccountNotFound
