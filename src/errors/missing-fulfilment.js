'use strict'

const NotFoundError = require('@mojaloop/central-services-shared').NotFoundError

class MissingFulfilmentError extends NotFoundError {
  constructor (message = 'This transfer has not yet been fulfilled') {
    super(message)
  }
}

module.exports = MissingFulfilmentError
