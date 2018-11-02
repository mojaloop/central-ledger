'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ParticipantAccountExistsError extends BaseError {
  constructor (message = 'Participant account already exists.') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = ParticipantAccountExistsError
