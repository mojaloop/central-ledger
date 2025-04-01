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

const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const Logger = require('../../shared/logger').logger

/**
 * @function processPositionFxFulfilBin
 *
 * @async
 * @description This is the domain function to process a bin of position-fx-fulfil messages of a single participant account.
 *
 * @param {array} binItems - an array of objects that contain a position fx reserve message and its span. {message, span}
 * @param {object} options
 *   @param {object} accumulatedFxTransferStates - object with fx transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @returns {object} - Returns an object containing accumulatedFxTransferStateChanges, accumulatedFxTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionFxFulfilBin = async (
  binItems,
  {
    accumulatedFxTransferStates
  }
) => {
  const fxTransferStateChanges = []
  const resultMessages = []
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)

  if (binItems && binItems.length > 0) {
    for (const binItem of binItems) {
      let transferStateId
      let reason
      let resultMessage
      const commitRequestId = binItem.message.value.content.uriParams.id
      const counterPartyFsp = binItem.message.value.from
      const initiatingFsp = binItem.message.value.to
      const fxTransfer = binItem.decodedPayload
      Logger.isDebugEnabled && Logger.debug(`processPositionFxFulfilBin::fxTransfer:processingMessage: ${JSON.stringify(fxTransfer)}`)
      Logger.isDebugEnabled && Logger.debug(`accumulatedFxTransferStates: ${JSON.stringify(accumulatedFxTransferStates)}`)
      Logger.isDebugEnabled && Logger.debug(`accumulatedFxTransferStates[commitRequestId]: ${accumulatedFxTransferStates[commitRequestId]}`)
      // Inform sender if transfer is not in RECEIVED_FULFIL_DEPENDENT state, skip making any transfer state changes
      if (accumulatedFxTransferStates[commitRequestId] !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT) {
        // forward same headers from the request, except the content-length header
        // set destination to counterPartyFsp and source to switch
        const headers = { ...binItem.message.value.content.headers }
        headers[Enum.Http.Headers.FSPIOP.DESTINATION] = counterPartyFsp
        headers[Enum.Http.Headers.FSPIOP.SOURCE] = Config.HUB_NAME
        delete headers['content-length']

        // There is no such logic in the fulfil handler.
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = 'FxFulfil in incorrect state'

        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `Invalid State: ${accumulatedFxTransferStates[commitRequestId]} - expected: ${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL_DEPENDENT}`
        ).toApiErrorObject(Config.ERROR_HANDLING)
        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.FAILURE.status,
          fspiopError.errorInformation.errorCode,
          fspiopError.errorInformation.errorDescription
        )

        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          commitRequestId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.FX_FULFIL,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          commitRequestId,
          counterPartyFsp,
          Config.HUB_NAME,
          metadata,
          headers,
          fspiopError,
          { id: commitRequestId },
          'application/json',
          binItem.message.value.content.context
        )
      } else {
        // forward same headers from the prepare message, except the content-length header
        const headers = { ...binItem.message.value.content.headers }
        delete headers['content-length']

        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.SUCCESS.status,
          null,
          null
        )
        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          commitRequestId,
          Enum.Kafka.Topics.TRANSFER,
          Enum.Events.Event.Action.COMMIT,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          commitRequestId,
          initiatingFsp,
          counterPartyFsp,
          metadata,
          headers,
          fxTransfer,
          { id: commitRequestId },
          'application/json',
          binItem.message.value.content.context
        )

        // No need to change the transfer state here for success case.

        binItem.result = { success: true }
      }

      resultMessages.push({ binItem, message: Utility.clone(resultMessage) })

      if (transferStateId) {
        const fxTransferStateChange = {
          commitRequestId,
          transferStateId,
          reason
        }
        fxTransferStateChanges.push(fxTransferStateChange)
        Logger.isDebugEnabled && Logger.debug(`processPositionFxFulfilBin::fxTransferStateChange: ${JSON.stringify(fxTransferStateChange)}`)

        accumulatedFxTransferStatesCopy[commitRequestId] = transferStateId
        Logger.isDebugEnabled && Logger.debug(`processPositionFxFulfilBin::accumulatedTransferStatesCopy:finalizedFxTransferState ${JSON.stringify(transferStateId)}`)
      }
    }
  }

  return {
    accumulatedFxTransferStates: accumulatedFxTransferStatesCopy, // finalized fx transfer state after fx-fulfil processing
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx transfer state changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

module.exports = {
  processPositionFxFulfilBin
}
