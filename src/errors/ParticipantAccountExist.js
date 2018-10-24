'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class ParticipantAccountExistError extends BaseError {
  constructor (message = 'Participant account already exist') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = ParticipantAccountExistError
