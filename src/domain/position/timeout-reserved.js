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
const MLNumber = require('@mojaloop/ml-number')
const Logger = require('../../shared/logger').logger

/**
 * @function processPositionTimeoutReservedBin
 *
 * @async
 * @description This is the domain function to process a bin of timeout-reserved messages of a single participant account.
 *
 * @param {array} timeoutReservedBins - an array containing timeout-reserved action bins
 * @param {object} options
  * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
  * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
  * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
  * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
  * @param {boolean} changePositions - whether to change positions or not
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionTimeoutReservedBin = async (
  timeoutReservedBins,
  {
    accumulatedPositionValue,
    accumulatedPositionReservedValue,
    accumulatedTransferStates,
    transferInfoList,
    changePositions = true
  }
) => {
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)
  // Position action RESERVED_TIMEOUT event messages are keyed either with the
  // payer's account id or an fxp target currency account of an associated fxTransfer.
  // We need to revert the payer's/fxp's position for the amount of the transfer.
  // The payer and payee are notified from the singular NOTIFICATION event RESERVED_TIMEOUT action
  if (timeoutReservedBins && timeoutReservedBins.length > 0) {
    for (const binItem of timeoutReservedBins) {
      Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::binItem: ${JSON.stringify(binItem.message.value)}`)
      const transferId = binItem.message.value.content.uriParams.id
      const payeeFsp = binItem.message.value.to
      const payerFsp = binItem.message.value.from

      // If the transfer is not in `RESERVED_TIMEOUT`, a position timeout-reserved message was incorrectly published.
      // i.e Something has gone extremely wrong.
      if (accumulatedTransferStates[transferId] !== Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
      } else {
        Logger.isDebugEnabled && Logger.debug(`accumulatedTransferStates: ${JSON.stringify(accumulatedTransferStates)}`)

        const transferAmount = transferInfoList[transferId].amount

        // Construct notification message
        const resultMessage = _constructTimeoutReservedResultMessage(
          binItem,
          transferId,
          payeeFsp,
          payerFsp
        )
        Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::resultMessage: ${JSON.stringify(resultMessage)}`)

        // Revert payer's or fxp's position for the amount of the transfer
        const { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition } =
          _handleParticipantPositionChange(runningPosition, transferAmount, transferId, accumulatedPositionReservedValue)
        Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)
        runningPosition = updatedRunningPosition
        binItem.result = { success: true }
        participantPositionChanges.push(participantPositionChange)
        transferStateChanges.push(transferStateChange)
        accumulatedTransferStatesCopy[transferId] = transferStateId
        resultMessages.push({ binItem, message: Utility.clone(resultMessage) })
      }
    }
  }

  return {
    accumulatedPositionValue: changePositions ? runningPosition.toNumber() : accumulatedPositionValue,
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    accumulatedPositionChanges: changePositions ? participantPositionChanges : [], // participant position changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

const _constructTimeoutReservedResultMessage = (binItem, transferId, payeeFsp, payerFsp) => {
  // IMPORTANT: This singular message is taken by the ml-api-adapter and used to
  //            notify the payer and payee of the timeout.
  //            As long as the `to` and `from` message values are the payer and payee,
  //            and the action is `timeout-reserved`, the ml-api-adapter will notify both.
  // Create a FSPIOPError object for timeout payee notification
  const fspiopError = ErrorHandler.Factory.createFSPIOPError(
    ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED,
    null,
    null,
    null,
    null
  ).toApiErrorObject(Config.ERROR_HANDLING)

  const state = Utility.StreamingProtocol.createEventState(
    Enum.Events.EventStatus.FAILURE.status,
    fspiopError.errorInformation.errorCode,
    fspiopError.errorInformation.errorDescription
  )

  // Create metadata for the message, associating the payee notification
  // with the position event timeout-reserved action
  const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
    transferId,
    Enum.Kafka.Topics.POSITION,
    Enum.Events.Event.Action.TIMEOUT_RESERVED,
    state
  )
  const resultMessage = Utility.StreamingProtocol.createMessage(
    transferId,
    payeeFsp,
    payerFsp,
    metadata,
    binItem.message.value.content.headers, // Headers don't really matter here. ml-api-adapter will ignore them and create their own.
    fspiopError,
    { id: transferId },
    'application/json',
    binItem.message.value.content.context
  )

  return resultMessage
}

const _handleParticipantPositionChange = (runningPosition, transferAmount, transferId, accumulatedPositionReservedValue) => {
  // NOTE: The transfer info amount is pulled from the payee records in a batch `SELECT` query.
  //       And will have a negative value. We add that value to the payer's(in regular transfer) or fxp's(in fx transfer) position
  //       to revert the position for the amount of the transfer.
  const transferStateId = Enum.Transfers.TransferInternalState.EXPIRED_RESERVED
  // Revert payer's or fxp's position for the amount of the transfer
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))
  Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::_handleParticipantPositionChange::updatedRunningPosition: ${updatedRunningPosition.toString()}`)
  Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::_handleParticipantPositionChange::transferAmount: ${transferAmount}`)
  // Construct participant position change object
  const participantPositionChange = {
    transferId, // Need to delete this in bin processor while updating transferStateChangeId
    transferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
    change: transferAmount,
    reservedValue: accumulatedPositionReservedValue
  }

  // Construct transfer state change object
  const transferStateChange = {
    transferId,
    transferStateId,
    reason: ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message
  }
  return { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition }
}

module.exports = {
  processPositionTimeoutReservedBin
}
