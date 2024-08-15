const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const MLNumber = require('@mojaloop/ml-number')
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function processPositionAbortBin
 *
 * @async
 * @description This is the domain function to process a bin of abort / fx-abort messages of a single participant account.
 *
 * @param {array} abortBins - an array containing abort / fx-abort action bins
 * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionAbortBin = async (
  abortBins,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedTransferStates,
  accumulatedFxTransferStates,
  isFx
) => {
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const followupMessages = []
  const fxTransferStateChanges = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)

  if (abortBins && abortBins.length > 0) {
    for (const binItem of abortBins) {
      Logger.isDebugEnabled && Logger.debug(`processPositionAbortBin::binItem: ${JSON.stringify(binItem.message.value)}`)
      if (isFx) {
        // If the transfer is not in `RECEIVED_ERROR`, a position fx-abort message was incorrectly published.
        // i.e Something has gone extremely wrong.
        if (accumulatedFxTransferStates[binItem.message.value.content.uriParams.id] !== Enum.Transfers.TransferInternalState.RECEIVED_ERROR) {
          throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
        }
      } else {
        // If the transfer is not in `RECEIVED_ERROR`, a position abort message was incorrectly published.
        // i.e Something has gone extremely wrong.
        if (accumulatedTransferStates[binItem.message.value.content.uriParams.id] !== Enum.Transfers.TransferInternalState.RECEIVED_ERROR) {
          throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
        }
      }

      const cyrilResult = binItem.message.value.content.context?.cyrilResult
      if (!cyrilResult || !cyrilResult.positionChanges || cyrilResult.positionChanges.length === 0) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
      }

      // Handle position movements
      // Iterate through positionChanges and handle each position movement, mark as done and publish a position-commit kafka message again for the next item
      // Find out the first item to be processed
      const positionChangeIndex = cyrilResult.positionChanges.findIndex(positionChange => !positionChange.isDone)
      const positionChangeToBeProcessed = cyrilResult.positionChanges[positionChangeIndex]
      if (positionChangeToBeProcessed.isFxTransferStateChange) {
        const { participantPositionChange, fxTransferStateChange, transferStateId, updatedRunningPosition } =
          _handleParticipantPositionChangeFx(runningPosition, positionChangeToBeProcessed.amount, positionChangeToBeProcessed.commitRequestId, accumulatedPositionReservedValue)
        runningPosition = updatedRunningPosition
        participantPositionChanges.push(participantPositionChange)
        fxTransferStateChanges.push(fxTransferStateChange)
        accumulatedFxTransferStatesCopy[positionChangeToBeProcessed.commitRequestId] = transferStateId
      } else {
        const { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition } =
          _handleParticipantPositionChange(runningPosition, positionChangeToBeProcessed.amount, positionChangeToBeProcessed.transferId, accumulatedPositionReservedValue)
        runningPosition = updatedRunningPosition
        participantPositionChanges.push(participantPositionChange)
        transferStateChanges.push(transferStateChange)
        accumulatedTransferStatesCopy[positionChangeToBeProcessed.transferId] = transferStateId
      }
      binItem.result = { success: true }
      cyrilResult.positionChanges[positionChangeIndex].isDone = true
      const nextIndex = cyrilResult.positionChanges.findIndex(positionChange => !positionChange.isDone)
      if (nextIndex === -1) {
        // All position changes are done, we need to inform all the participants about the abort
        // Construct a list of messages excluding the original message as it will notified anyway
        for (const positionChange of cyrilResult.positionChanges) {
          if (positionChange.isFxTransferStateChange) {
            // Construct notification message for fx transfer state change
            const resultMessage = _constructAbortResultMessage(binItem, positionChange.commitRequestId, Config.HUB_NAME, positionChange.notifyTo, Enum.Events.Event.Action.FX_ABORT)
            resultMessages.push({ binItem, message: resultMessage })
          } else {
            // Construct notification message for transfer state change
            const resultMessage = _constructAbortResultMessage(binItem, positionChange.transferId, Config.HUB_NAME, positionChange.notifyTo, Enum.Events.Event.Action.ABORT)
            resultMessages.push({ binItem, message: resultMessage })
          }
        }
      } else {
        // There are still position changes to be processed
        // Send position-commit kafka message again for the next item
        const participantCurrencyId = cyrilResult.positionChanges[nextIndex].participantCurrencyId
        // const followupMessage = _constructTransferAbortFollowupMessage(binItem, transferId, payerFsp, payeeFsp, transfer)
        // Pass down the context to the followup message with mutated cyrilResult
        const followupMessage = { ...binItem.message.value }
        // followupMessage.content.context = binItem.message.value.content.context
        followupMessages.push({ binItem, messageKey: participantCurrencyId.toString(), message: followupMessage })
      }
    }
  }

  return {
    accumulatedPositionValue: runningPosition.toNumber(),
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx transfer state changes to be persisted in order
    accumulatedPositionChanges: participantPositionChanges, // participant position changes to be persisted in order
    notifyMessages: resultMessages, // array of objects containing bin item and result message. {binItem, message}
    followupMessages // array of objects containing bin item, message key and followup message. {binItem, messageKey, message}
  }
}

const _constructAbortResultMessage = (binItem, id, from, notifyTo, action) => {
  const fspiopError = ErrorHandler.Factory.createFSPIOPError(
    ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_REJECTION, // TODO: Need clarification on this
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

  // Create metadata for the message
  const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
    id,
    Enum.Kafka.Topics.POSITION,
    action,
    state
  )
  const resultMessage = Utility.StreamingProtocol.createMessage(
    id,
    from,
    notifyTo,
    metadata,
    binItem.message.value.content.headers, // Headers don't really matter here. ml-api-adapter will ignore them and create their own.
    fspiopError,
    { id },
    'application/json'
  )

  return resultMessage
}

const _handleParticipantPositionChange = (runningPosition, transferAmount, transferId, accumulatedPositionReservedValue) => {
  const transferStateId = Enum.Transfers.TransferInternalState.ABORTED_ERROR
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))

  const participantPositionChange = {
    transferId, // Need to delete this in bin processor while updating transferStateChangeId
    transferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
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

const _handleParticipantPositionChangeFx = (runningPosition, transferAmount, commitRequestId, accumulatedPositionReservedValue) => {
  const transferStateId = Enum.Transfers.TransferInternalState.ABORTED_ERROR
  // Amounts in `transferParticipant` for the payee are stored as negative values
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))

  const participantPositionChange = {
    commitRequestId, // Need to delete this in bin processor while updating fxTransferStateChangeId
    fxTransferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
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
  processPositionAbortBin
}
