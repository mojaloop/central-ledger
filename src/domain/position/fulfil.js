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
const TransferObjectTransform = require('../../domain/transfer/transform')

/**
 * @function processPositionFulfilBin
 *
 * @async
 * @description This is the domain function to process a bin of position-fulfil messages of a single participant account.
 *
 * @param {array} commitReserveFulfilBins - an array containing commit and reserve action bins
 * @param {object} options
  * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
  * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
  * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
  * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
  * @param {boolean} changePositions - whether to change positions or not
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionFulfilBin = async (
  commitReserveFulfilBins,
  {
    accumulatedPositionValue,
    accumulatedPositionReservedValue,
    accumulatedTransferStates,
    accumulatedFxTransferStates,
    transferInfoList,
    reservedActionTransfers,
    changePositions = true
  }
) => {
  const transferStateChanges = []
  const fxTransferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const followupMessages = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)

  for (const binItems of commitReserveFulfilBins) {
    if (binItems && binItems.length > 0) {
      for (const binItem of binItems) {
        const transferId = binItem.message.value.content.uriParams.id
        const payeeFsp = binItem.message.value.from
        const payerFsp = binItem.message.value.to
        const transfer = binItem.decodedPayload

        // Inform payee dfsp if transfer is not in RECEIVED_FULFIL state, skip making any transfer state changes
        if (accumulatedTransferStates[transferId] !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
          const resultMessage = _handleIncorrectTransferState(binItem, payeeFsp, transferId, accumulatedTransferStates)
          resultMessages.push({ binItem, message: Utility.clone(resultMessage) })
        } else {
          Logger.isDebugEnabled && Logger.debug(`processPositionFulfilBin::transfer:processingMessage: ${JSON.stringify(transfer)}`)
          Logger.isDebugEnabled && Logger.debug(`accumulatedTransferStates: ${JSON.stringify(accumulatedTransferStates)}`)
          const cyrilResult = binItem.message.value.content.context?.cyrilResult
          if (cyrilResult && cyrilResult.isFx) {
            // This is FX transfer
            // Handle position movements
            // Iterate through positionChanges and handle each position movement, mark as done and publish a position-commit kafka message again for the next item
            // Find out the first item to be processed
            const positionChangeIndex = cyrilResult.positionChanges.findIndex(positionChange => !positionChange.isDone)
            const positionChangeToBeProcessed = cyrilResult.positionChanges[positionChangeIndex]
            let transferStateIdCopy
            if (positionChangeToBeProcessed.isFxTransferStateChange) {
              const { participantPositionChange, fxTransferStateChange, transferStateId, updatedRunningPosition } =
                _handleParticipantPositionChangeFx(runningPosition, positionChangeToBeProcessed.amount, positionChangeToBeProcessed.commitRequestId, accumulatedPositionReservedValue)
              transferStateIdCopy = transferStateId
              runningPosition = updatedRunningPosition
              participantPositionChanges.push(participantPositionChange)
              fxTransferStateChanges.push(fxTransferStateChange)
              accumulatedFxTransferStatesCopy[positionChangeToBeProcessed.commitRequestId] = transferStateId
              const patchMessages = _constructPatchNotificationResultMessage(
                binItem,
                cyrilResult
              )
              for (const patchMessage of patchMessages) {
                resultMessages.push({ binItem, message: patchMessage })
              }
            } else {
              const { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition } =
                _handleParticipantPositionChange(runningPosition, positionChangeToBeProcessed.amount, positionChangeToBeProcessed.transferId, accumulatedPositionReservedValue)
              transferStateIdCopy = transferStateId
              runningPosition = updatedRunningPosition
              participantPositionChanges.push(participantPositionChange)
              transferStateChanges.push(transferStateChange)
              accumulatedTransferStatesCopy[positionChangeToBeProcessed.transferId] = transferStateId
            }
            binItem.result = { success: true }
            cyrilResult.positionChanges[positionChangeIndex].isDone = true
            const nextIndex = cyrilResult.positionChanges.findIndex(positionChange => !positionChange.isDone)
            if (nextIndex === -1) {
              // All position changes are done
              const resultMessage = _constructTransferFulfilResultMessage(binItem, transferId, payerFsp, payeeFsp, transfer, reservedActionTransfers, transferStateIdCopy)
              resultMessages.push({ binItem, message: Utility.clone(resultMessage) })
            } else {
              // There are still position changes to be processed
              // Send position-commit kafka message again for the next item
              const participantCurrencyId = cyrilResult.positionChanges[nextIndex].participantCurrencyId
              const followupMessage = _constructTransferFulfilResultMessage(binItem, transferId, payerFsp, payeeFsp, transfer, reservedActionTransfers, transferStateIdCopy)
              // Pass down the context to the followup message with mutated cyrilResult
              followupMessage.content.context = binItem.message.value.content.context
              followupMessages.push({ binItem, messageKey: participantCurrencyId.toString(), message: followupMessage })
            }
          } else {
            const transferAmount = transferInfoList[transferId].amount
            const { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition } =
              _handleParticipantPositionChange(runningPosition, transferAmount, transferId, accumulatedPositionReservedValue)
            runningPosition = updatedRunningPosition
            binItem.result = { success: true }
            participantPositionChanges.push(participantPositionChange)
            transferStateChanges.push(transferStateChange)
            accumulatedTransferStatesCopy[transferId] = transferStateId
            const resultMessage = _constructTransferFulfilResultMessage(binItem, transferId, payerFsp, payeeFsp, transfer, reservedActionTransfers, transferStateId)
            resultMessages.push({ binItem, message: Utility.clone(resultMessage) })
          }
        }
      }
    }
  }

  return {
    accumulatedPositionValue: changePositions ? runningPosition.toNumber() : accumulatedPositionValue,
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after fulfil processing
    accumulatedFxTransferStates: accumulatedFxTransferStatesCopy, // finalized transfer state after fx fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx-transfer state changes to be persisted in order
    accumulatedPositionChanges: changePositions ? participantPositionChanges : [], // participant position changes to be persisted in order
    notifyMessages: resultMessages, // array of objects containing bin item and result message. {binItem, message}
    followupMessages // array of objects containing bin item, message key and followup message. {binItem, messageKey, message}
  }
}

const _handleIncorrectTransferState = (binItem, payeeFsp, transferId, accumulatedTransferStates) => {
  // forward same headers from the prepare message, except the content-length header
  // set destination to payeefsp and source to switch
  const headers = { ...binItem.message.value.content.headers }
  headers[Enum.Http.Headers.FSPIOP.DESTINATION] = payeeFsp
  headers[Enum.Http.Headers.FSPIOP.SOURCE] = Config.HUB_NAME
  delete headers['content-length']

  const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
    `Invalid State: ${accumulatedTransferStates[transferId]} - expected: ${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL}`
  ).toApiErrorObject(Config.ERROR_HANDLING)
  const state = Utility.StreamingProtocol.createEventState(
    Enum.Events.EventStatus.FAILURE.status,
    fspiopError.errorInformation.errorCode,
    fspiopError.errorInformation.errorDescription
  )

  const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
    transferId,
    Enum.Kafka.Topics.NOTIFICATION,
    Enum.Events.Event.Action.FULFIL,
    state
  )

  return Utility.StreamingProtocol.createMessage(
    transferId,
    payeeFsp,
    Config.HUB_NAME,
    metadata,
    headers,
    fspiopError,
    { id: transferId },
    'application/json',
    binItem.message.value.content.context
  )
}

const _constructTransferFulfilResultMessage = (binItem, transferId, payerFsp, payeeFsp, transfer, reservedActionTransfers, transferStateId) => {
  // forward same headers from the prepare message, except the content-length header
  const headers = { ...binItem.message.value.content.headers }
  delete headers['content-length']

  const state = Utility.StreamingProtocol.createEventState(
    Enum.Events.EventStatus.SUCCESS.status,
    null,
    null
  )
  const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
    transferId,
    Enum.Kafka.Topics.TRANSFER,
    Enum.Events.Event.Action.COMMIT,
    state
  )

  const resultMessage = Utility.StreamingProtocol.createMessage(
    transferId,
    payerFsp,
    payeeFsp,
    metadata,
    headers,
    transfer,
    { id: transferId },
    'application/json',
    binItem.message.value.content.context
  )

  if (binItem.message.value.metadata.event.action === Enum.Events.Event.Action.RESERVE) {
    resultMessage.content.payload = TransferObjectTransform.toFulfil(
      reservedActionTransfers[transferId]
    )
    resultMessage.content.payload.transferState = transferStateId
  }
  return resultMessage
}

const _constructPatchNotificationResultMessage = (binItem, cyrilResult) => {
  const messages = []
  const patchNotifications = cyrilResult.patchNotifications
  for (const patchNotification of patchNotifications) {
    const commitRequestId = patchNotification.commitRequestId
    const fxpName = patchNotification.fxpName
    const fulfilment = patchNotification.fulfilment
    const completedTimestamp = patchNotification.completedTimestamp
    const headers = {
      ...binItem.message.value.content.headers,
      'fspiop-source': Config.HUB_NAME,
      'fspiop-destination': fxpName
    }

    const fulfil = {
      conversionState: Enum.Transfers.TransferState.COMMITTED,
      fulfilment,
      completedTimestamp
    }

    const state = Utility.StreamingProtocol.createEventState(
      Enum.Events.EventStatus.SUCCESS.status,
      null,
      null
    )
    const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
      commitRequestId,
      Enum.Kafka.Topics.TRANSFER,
      Enum.Events.Event.Action.FX_NOTIFY,
      state
    )

    const resultMessage = Utility.StreamingProtocol.createMessage(
      commitRequestId,
      fxpName,
      Config.HUB_NAME,
      metadata,
      headers,
      fulfil,
      { id: commitRequestId },
      'application/json',
      binItem.message.value.content.context
    )

    messages.push(resultMessage)
  }
  return messages
}

const _handleParticipantPositionChange = (runningPosition, transferAmount, transferId, accumulatedPositionReservedValue) => {
  const transferStateId = Enum.Transfers.TransferState.COMMITTED
  // Amounts in `transferParticipant` for the payee are stored as negative values
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))

  const participantPositionChange = {
    transferId, // Need to delete this in bin processor while updating transferStateChangeId
    transferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
    change: transferAmount,
    reservedValue: accumulatedPositionReservedValue
  }

  const transferStateChange = {
    transferId,
    transferStateId,
    reason: undefined
  }
  return { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition }
}

const _handleParticipantPositionChangeFx = (runningPosition, transferAmount, commitRequestId, accumulatedPositionReservedValue) => {
  const transferStateId = Enum.Transfers.TransferState.COMMITTED
  // Amounts in `transferParticipant` for the payee are stored as negative values
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))

  const participantPositionChange = {
    commitRequestId, // Need to delete this in bin processor while updating fxTransferStateChangeId
    fxTransferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
    change: transferAmount,
    reservedValue: accumulatedPositionReservedValue
  }

  const fxTransferStateChange = {
    commitRequestId,
    transferStateId,
    reason: null
  }
  return { participantPositionChange, fxTransferStateChange, transferStateId, updatedRunningPosition }
}

module.exports = {
  processPositionFulfilBin
}
