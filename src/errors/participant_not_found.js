'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ParticipantNotFoundError extends BaseError {
  constructor (message = 'Participant was not found.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = ParticipantNotFoundError
