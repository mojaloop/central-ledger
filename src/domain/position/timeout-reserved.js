const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const MLNumber = require('@mojaloop/ml-number')

/**
 * @function processPositionTimeoutReservedBin
 *
 * @async
 * @description This is the domain function to process a bin of timeout-reserved messages of a single participant account.
 *
 * @param {array} timeoutReservedBins - an array containing timeout-reserved action bins
 * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionTimeoutReservedBin = async (
  timeoutReservedBins,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedTransferStates,
  accumulatedFxTransferStates,
  transferInfoList,
  reservedActionTransfers
) => {
  const transferStateChanges = []
  const fxTransferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const followupMessages = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)
  // Position action RESERVED_TIMEOUT event messages are keyed with payer account id.
  // We need to revert the payer's position for the amount of the transfer.
  // We need to notify the payee of the timeout.
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

        // Construct payee notification message
        const resultMessage = _constructTimeoutReservedResultMessage(
          binItem,
          transferId,
          payeeFsp,
          payerFsp
        )
        Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::resultMessage: ${JSON.stringify(resultMessage)}`)

        // Revert payer's position for the amount of the transfer
        const { participantPositionChange, transferStateChange, transferStateId, updatedRunningPosition } =
          _handleParticipantPositionChange(runningPosition, transferAmount, transferId, accumulatedPositionReservedValue)
        Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)
        runningPosition = updatedRunningPosition
        binItem.result = { success: true }
        participantPositionChanges.push(participantPositionChange)
        transferStateChanges.push(transferStateChange)
        accumulatedTransferStatesCopy[transferId] = transferStateId
        resultMessages.push({ binItem, message: resultMessage })
      }
    }
  }

  return {
    accumulatedPositionValue: runningPosition.toNumber(),
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after fulfil processing
    accumulatedFxTransferStates: accumulatedFxTransferStatesCopy, // finalized transfer state after fx fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx-transfer state changes to be persisted in order
    accumulatedPositionChanges: participantPositionChanges, // participant position changes to be persisted in order
    notifyMessages: resultMessages, // array of objects containing bin item and result message. {binItem, message}
    followupMessages // array of objects containing bin item, message key and followup message. {binItem, messageKey, message}
  }
}

const _constructTimeoutReservedResultMessage = (binItem, transferId, payeeFsp, payerFsp) => {
  const headers = { ...binItem.message.value.content.headers }
  headers[Enum.Http.Headers.FSPIOP.DESTINATION] = payeeFsp
  headers[Enum.Http.Headers.FSPIOP.SOURCE] = payerFsp
  delete headers['content-length']

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
    headers, // Unsure what headers need to be passed here
    fspiopError,
    { id: transferId },
    'application/json'
  )

  return resultMessage
}

const _handleParticipantPositionChange = (runningPosition, transferAmount, transferId, accumulatedPositionReservedValue) => {
  const transferStateId = Enum.Transfers.TransferInternalState.EXPIRED_RESERVED
  // Revert payer's position for the amount of the transfer
  // NOTE: We are pulling the transferAmount using
  // const latestTransferInfoByTransferId = await BatchPositionModel.getTransferInfoList(
  //   trx,
  //   transferIdList,
  //   Enum.Accounts.TransferParticipantRoleType.PAYEE_DFSP,
  //   Enum.Accounts.LedgerEntryType.PRINCIPLE_VALUE
  // )
  // Is it safe using this value of the payee even accounting for the negative value?
  const updatedRunningPosition = new MLNumber(runningPosition.add(transferAmount).toFixed(Config.AMOUNT.SCALE))
  Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::_handleParticipantPositionChange::updatedRunningPosition: ${updatedRunningPosition.toString()}`)
  Logger.isDebugEnabled && Logger.debug(`processPositionTimeoutReservedBin::_handleParticipantPositionChange::transferAmount: ${transferAmount}`)
  // Construct participant position change object
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

module.exports = {
  processPositionTimeoutReservedBin
}
