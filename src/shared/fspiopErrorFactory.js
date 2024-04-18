/* eslint-disable no-return-assign */
const { Factory, Enums } = require('@mojaloop/central-services-error-handling')
const { logger } = require('../shared/logger')
const { ERROR_MESSAGES } = require('./constants')

const fspiopErrorFactory = {
  fxTransferNotFound: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.TRANSFER_ID_NOT_FOUND, // todo: should we create a new error FX_TRANSFER_ID_NOT_FOUND?
      ERROR_MESSAGES.fxTransferNotFound,
      cause, replyTo
    )
  },

  fxHeaderSourceValidationError: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      ERROR_MESSAGES.fxTransferHeaderSourceValidationError,
      cause, replyTo
    )
  },

  fxHeaderDestinationValidationError: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      ERROR_MESSAGES.fxTransferHeaderDestinationValidationError,
      cause, replyTo
    )
  },

  fxInvalidFulfilment: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      ERROR_MESSAGES.fxInvalidFulfilment,
      cause, replyTo
    )
  },

  fxTransferNonReservedState: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
      ERROR_MESSAGES.fxTransferNonReservedState,
      cause, replyTo
    )
  },

  fxTransferExpired: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED,
      ERROR_MESSAGES.fxTransferExpired,
      cause = null, replyTo = ''
    )
  },

  invalidEventType: (type, cause = null, replyTo = '') => {
    return Factory.createInternalServerFSPIOPError(
      ERROR_MESSAGES.invalidEventType(type),
      cause, replyTo
    )
  },

  invalidFxTransferState: ({ transferStateEnum, action, type }, cause = null, replyTo = '') => {
    return Factory.createInternalServerFSPIOPError(
      ERROR_MESSAGES.invalidFxTransferState({ transferStateEnum, action, type }),
      cause, replyTo
    )
  },

  noFxDuplicateHash: (cause = null, replyTo = '') => {
    return Factory.createFSPIOPError(
      Enums.FSPIOPErrorCodes.MODIFIED_REQUEST,
      ERROR_MESSAGES.noFxDuplicateHash,
      cause, replyTo
    )
  },

  fromErrorInformation: (errInfo, cause = null, replyTo = '') => {
    let fspiopError

    try { // handle only valid errorCodes provided by the payee
      fspiopError = Factory.createFSPIOPErrorFromErrorInformation(errInfo)
    } catch (err) {
      /**
       * TODO: Handling of out-of-range errorCodes is to be introduced to the ml-api-adapter,
       * so that such requests are rejected right away, instead of aborting the transfer here.
       */
      logger.error(`apiErrorCode error: ${err?.message}`)
      fspiopError = Factory.createFSPIOPError(
        Enums.FSPIOPErrorCodes.VALIDATION_ERROR,
        ERROR_MESSAGES.invalidApiErrorCode,
        cause, replyTo
      )
    }
    return fspiopError
  }

}

module.exports = fspiopErrorFactory
