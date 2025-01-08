/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

const fxTransferModel = require('../../models/fxTransfer')
const TransferService = require('../../domain/transfer')
const cyril = require('../../domain/fx/cyril')
const { logger } = require('../../shared/logger')

/** @import { ProxyObligation } from './prepare.js' */

// abstraction on transfer and fxTransfer
const createRemittanceEntity = (isFx) => {
  return {
    isFx,

    async getDuplicate (id) {
      return isFx
        ? fxTransferModel.duplicateCheck.getFxTransferDuplicateCheck(id)
        : TransferService.getTransferDuplicateCheck(id)
    },
    async saveDuplicateHash (id, hash) {
      return isFx
        ? fxTransferModel.duplicateCheck.saveFxTransferDuplicateCheck(id, hash)
        : TransferService.saveTransferDuplicateCheck(id, hash)
    },

    /**
     * Saves prepare transfer/fxTransfer details to DB.
     *
     * @param {Object} payload - Message payload.
     * @param {string | null} reason - Validation failure reasons.
     * @param {Boolean} isValid - isValid.
     * @param {DeterminingTransferCheckResult} determiningTransferCheckResult - The determining transfer check result.
     * @param {ProxyObligation} proxyObligation - The proxy obligation
     * @returns {Promise<void>}
     */
    async savePreparedRequest (
      payload,
      reason,
      isValid,
      determiningTransferCheckResult,
      proxyObligation
    ) {
      return isFx
        ? fxTransferModel.fxTransfer.savePreparedRequest(
          payload,
          reason,
          isValid,
          determiningTransferCheckResult,
          proxyObligation
        )
        : TransferService.prepare(
          payload,
          reason,
          isValid,
          determiningTransferCheckResult,
          proxyObligation
        )
    },

    async getByIdLight (id) {
      return isFx
        ? fxTransferModel.fxTransfer.getByIdLight(id)
        : TransferService.getByIdLight(id)
    },

    /**
     * @typedef {Object} DeterminingTransferCheckResult
     *
     * @property {boolean} determiningTransferExists - Indicates if the determining transfer exists.
     * @property {Array<{participantName, currencyId}>} participantCurrencyValidationList - List of validations for participant currencies.
     * @property {Object} [transferRecord] - Determining transfer for the FX transfer (optional).
     * @property {Array} [watchListRecords] - Records from fxWatchList-table for the transfer (optional).
     */
    /**
     * Checks if a determining transfer exists based on the payload and proxy obligation.
     * The function determines which method to use based on whether it is an FX transfer.
     *
     * @param {Object} payload - The payload data required for the transfer check.
     * @param {ProxyObligation} proxyObligation - The proxy obligation details.
     * @returns {DeterminingTransferCheckResult} determiningTransferCheckResult
     */
    async checkIfDeterminingTransferExists (payload, proxyObligation) {
      const result = isFx
        ? await cyril.checkIfDeterminingTransferExistsForFxTransferMessage(payload, proxyObligation)
        : await cyril.checkIfDeterminingTransferExistsForTransferMessage(payload, proxyObligation)

      logger.debug('cyril determiningTransferCheckResult:', { result })
      return result
    },

    async getPositionParticipant (payload, determiningTransferCheckResult, proxyObligation) {
      const result = isFx
        ? await cyril.getParticipantAndCurrencyForFxTransferMessage(payload, determiningTransferCheckResult)
        : await cyril.getParticipantAndCurrencyForTransferMessage(payload, determiningTransferCheckResult, proxyObligation)

      logger.debug('cyril getPositionParticipant result:', { result })
      return result
    },

    async logTransferError (id, errorCode, errorDescription) {
      return isFx
        ? fxTransferModel.stateChange.logTransferError(id, errorCode, errorDescription)
        : TransferService.logTransferError(id, errorCode, errorDescription)
    }
  }
}

module.exports = createRemittanceEntity
