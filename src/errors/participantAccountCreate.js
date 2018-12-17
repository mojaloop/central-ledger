'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ParticipantAccountCreateError extends BaseError {
  constructor (message = 'Participant account and Position create have failed.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = ParticipantAccountCreateError
