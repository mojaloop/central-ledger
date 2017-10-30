'use strict'

const Shared = require('@mojaloop/central-services-shared')

class InvalidBodyError extends Shared.BaseError {
  constructor (message = 'Invalid body') {
    super(Shared.ErrorCategory.BAD_REQUEST, message)
  }
}

module.exports = InvalidBodyError
