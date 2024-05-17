const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const MLNumber = require('@mojaloop/ml-number')
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function processPositionFxTimeoutReservedBin
 *
 * @async
 * @description This is the domain function to process a bin of timeout-reserved messages of a single participant account.
 *
 * @param {array} fxTimeoutReservedBins - an array containing timeout-reserved action bins
 * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 * @param {object} accumulatedFxTransferStates - object with commitRequest id keys and fxTransfer state id values. Used to check if fxTransfer is in correct state for processing. Clone and update states for output.
 * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedFxTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionFxTimeoutReservedBin = async (
  fxTimeoutReservedBins,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedFxTransferStates,
  latestInitiatingFxTransferInfoByFxCommitRequestId
) => {
  const fxTransferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)
  // Position action FX_RESERVED_TIMEOUT event messages are keyed with payer account id.
  // We need to revert the payer's position for the source currency amount of the fxTransfer.
  // We need to notify the payee of the timeout.
  if (fxTimeoutReservedBins && fxTimeoutReservedBins.length > 0) {
    for (const binItem of fxTimeoutReservedBins) {
      Logger.isDebugEnabled && Logger.debug(`processPositionFxTimeoutReservedBin::binItem: ${JSON.stringify(binItem.message.value)}`)
      const commitRequestId = binItem.message.value.content.uriParams.id
      const fxp = binItem.message.value.to
      const payerFsp = binItem.message.value.from

      // If the transfer is not in `RESERVED_TIMEOUT`, a position fx-timeout-reserved message was incorrectly published.
      // i.e Something has gone extremely wrong.
      if (accumulatedFxTransferStates[commitRequestId] !== Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        throw ErrorHandler.Factory.createInternalServerFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR.message)
      } else {
        Logger.isDebugEnabled && Logger.debug(`accumulatedFxTransferStates: ${JSON.stringify(accumulatedFxTransferStates)}`)

        const transferAmount = latestInitiatingFxTransferInfoByFxCommitRequestId[commitRequestId].amount

        // Construct payee notification message
        const resultMessage = _constructFxTimeoutReservedResultMessage(
          binItem,
          commitRequestId,
          fxp,
          payerFsp
        )
        Logger.isDebugEnabled && Logger.debug(`processPositionFxTimeoutReservedBin::resultMessage: ${JSON.stringify(resultMessage)}`)

        // Revert payer's position for the amount of the transfer
        const { participantPositionChange, fxTransferStateChange, transferStateId, updatedRunningPosition } =
          _handleParticipantPositionChange(runningPosition, transferAmount, commitRequestId, accumulatedPositionReservedValue)
        Logger.isDebugEnabled && Logger.debug(`processPositionFxTimeoutReservedBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)
        runningPosition = updatedRunningPosition
        binItem.result = { success: true }
        participantPositionChanges.push(participantPositionChange)
        fxTransferStateChanges.push(fxTransferStateChange)
        accumulatedFxTransferStatesCopy[commitRequestId] = transferStateId
        resultMessages.push({ binItem, message: resultMessage })
      }
    }
  }

  return {
    accumulatedPositionValue: runningPosition.toNumber(),
    accumulatedFxTransferStates: accumulatedFxTransferStatesCopy, // finalized transfer state after fx fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx-transfer state changes to be persisted in order
    accumulatedPositionChanges: participantPositionChanges, // participant position changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

const _constructFxTimeoutReservedResultMessage = (binItem, transferId, fxp, payerFsp) => {
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
  // with the position event fx-timeout-reserved action
  const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
    transferId,
    Enum.Kafka.Topics.POSITION,
    Enum.Events.Event.Action.FX_TIMEOUT_RESERVED,
    state
  )
  const resultMessage = Utility.StreamingProtocol.createMessage(
    transferId,
    fxp,
    payerFsp,
    metadata,
    binItem.message.value.content.headers, // Headers don't really matter here. ml-api-adapter will ignore them and create their own.
    fspiopError,
    { id: transferId },
    'application/json'
  )

  return resultMessage
}

const _handleParticipantPositionChange = (runningPosition, transferAmount, commitRequestId, accumulatedPositionReservedValue) => {
  // NOTE: The transfer info amount is pulled from the payee records in a batch `SELECT` query.
  //       And will have a negative value. We add that value to the payer's position
  //       to revert the position for the amount of the transfer.
  const transferStateId = Enum.Transfers.TransferInternalState.EXPIRED_RESERVED
  // Revert payer's position for the amount of the transfer
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))
  Logger.isDebugEnabled && Logger.debug(`processPositionFxTimeoutReservedBin::_handleParticipantPositionChange::updatedRunningPosition: ${updatedRunningPosition.toString()}`)
  Logger.isDebugEnabled && Logger.debug(`processPositionFxTimeoutReservedBin::_handleParticipantPositionChange::transferAmount: ${transferAmount}`)
  // Construct participant position change object
  const participantPositionChange = {
    commitRequestId, // Need to delete this in bin processor while updating transferStateChangeId
    transferStateChangeId: null, // Need to update this in bin processor while executing queries
    value: updatedRunningPosition.toNumber(),
    reservedValue: accumulatedPositionReservedValue
  }

  // Construct transfer state change object
  const fxTransferStateChange = {
    commitRequestId,
    transferStateId,
    reason: ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message
  }
  return { participantPositionChange, fxTransferStateChange, transferStateId, updatedRunningPosition }
}

module.exports = {
  processPositionFxTimeoutReservedBin
}
