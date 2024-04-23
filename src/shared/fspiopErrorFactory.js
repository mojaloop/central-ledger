/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Eugen Klymniuk <eugen.klymniuk@infitx.com
 --------------
 **********/

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
