'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const ErrorCategory = Shared.ErrorCategory

class RecordExistsError extends BaseError {
  constructor (message = 'Participant currency has already been registered') {
    super(ErrorCategory.UNPROCESSABLE, message)
  }
}

module.exports = RecordExistsError
