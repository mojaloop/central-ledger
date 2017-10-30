'use strict'

const Shared = require('@mojaloop/central-services-shared')

class InvalidModificationError extends Shared.BaseError {
  constructor (message) {
    super(Shared.ErrorCategory.BAD_REQUEST, message)
  }
}

module.exports = InvalidModificationError
