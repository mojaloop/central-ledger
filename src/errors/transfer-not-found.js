'use strict'

const NotFoundError = require('@mojaloop/central-services-shared').NotFoundError

class TransferNotFoundError extends NotFoundError {
  constructor (message = 'This transfer does not exist') {
    super(message)
  }
}

module.exports = TransferNotFoundError
