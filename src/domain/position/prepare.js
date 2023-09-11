const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const resourceVersions = require('@mojaloop/central-services-shared').Util.resourceVersions
const MLNumber = require('@mojaloop/ml-number')

/**
 * @function processPositionPrepareBin
 *
 * @async
 * @description This is the domain function to process a bin of position-prepare messages of a single participant account.
 *
 * @param {array} messages - a list of messages to consume for the relevant topic
 * @param {object} initialTransferStateChangeList - A list of initial transfer state changes for the transferIds in the bin
 * @param {number} accumulatedPositionValue - value of position accumulated so far
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far
 * @param {number} settlementPositionValue - value of settlement position to be used for liquidity check
 * @param {number} settlementModelDelay - settlement model delay (IMMEDIATE or DEFERRED)
 * @param {number} participantLimitValue - NDC limit of participant
 * @param {array} accumulatedTransferStateChanges - list of accumulated transfer state changes
 *
 * @returns {object} - Returns an object containing  accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionPrepareBin = async (
  messages,
  initialTransferStateChangeList,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  settlementPositionValue,
  settlementModelDelay,
  participantLimit,
  participantLimitValue,
  accumulatedTransferStateChanges
) => {
  let availablePosition
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const limitAlarms = []
  const effectivePosition = new MLNumber(accumulatedPositionValue + accumulatedPositionReservedValue)
  const liquidityCover = new MLNumber(settlementPositionValue).multiply(-1)

  // Enum.Settlements.SettlementDelay.IMMEDIATE or SettlementDelayName.IMMEDIATE. 0/1 or string?
  if (settlementModelDelay === Enum.Settlements.SettlementDelay.IMMEDIATE) {
    availablePosition = new MLNumber(settlementPositionValue + participantLimitValue - effectivePosition)
  } else {
    availablePosition = new MLNumber(participantLimitValue - effectivePosition)
  }

  for (const message of messages) {
    let transferStateId
    let reason
    let resultMessage

    if (initialTransferStateChangeList[message.transferId] !== Enum.Transfers.TransferInternalState.RECEIVED_PREPARE) {
      transferStateId = Enum.Transfers.TransferState.ABORTED_REJECTED
      reason = 'Transfer in incorrect state'

      const headers = Utility.Http.SwitchDefaultHeaders(
        message.payerFsp,
        Enum.Http.HeaderResources.TRANSFERS,
        Enum.Http.Headers.FSPIOP.SWITCH.value,
        resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion
      )
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR
      ).toApiErrorObject(Config.ERROR_HANDLING)
      const state = Utility.StreamingProtocol.createEventState(
        Enum.Events.EventStatus.FAILURE.status,
        fspiopError.errorInformation.errorCode,
        fspiopError.errorInformation.errorDescription
      )
      const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
        message.transferId,
        Enum.Kafka.Topics.NOTIFICATION,
        Enum.Events.Event.Action.PREPARE,
        state
      )

      resultMessage = Utility.StreamingProtocol.createMessage(
        message.transferId,
        message.payeeFsp,
        message.payerFsp,
        metadata,
        headers,
        fspiopError,
        { id: message.transferId },
        'application/json'
      )
    } else if (availablePosition >= message.payload.amount.amount) {
      transferStateId = Enum.Transfers.TransferState.RESERVED
      availablePosition = availablePosition - message.payload.amount.amount

      const headers = null // ?
      const state = Utility.StreamingProtocol.createEventState(
        Enum.Events.EventStatus.SUCCESS.status,
        null,
        null
      )
      const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
        message.transferId,
        Enum.Kafka.Topics.TRANSFER,
        Enum.Events.Event.Action.PREPARE,
        state
      )

      resultMessage = Utility.StreamingProtocol.createMessage(
        message.transferId,
        message.payeeFsp,
        message.payerFsp,
        metadata,
        headers,
        null,
        { id: message.transferId },
        'application/json'
      )
    } else {
      transferStateId = Enum.Transfers.TransferState.ABORTED
      reason = 'Net Debit Cap exceeded by this request at this time, please try again later'

      const headers = Utility.Http.SwitchDefaultHeaders(
        message.payerFsp,
        Enum.Http.HeaderResources.TRANSFERS,
        Enum.Http.Headers.FSPIOP.SWITCH.value,
        resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion
      )
      const fspiopError = ErrorHandler.Factory.createFSPIOPError(
        ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY
      ).toApiErrorObject(Config.ERROR_HANDLING)
      const state = Utility.StreamingProtocol.createEventState(
        Enum.Events.EventStatus.FAILURE.status,
        fspiopError.errorInformation.errorCode,
        fspiopError.errorInformation.errorDescription
      )
      const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
        message.transferId,
        Enum.Kafka.Topics.NOTIFICATION,
        Enum.Events.Event.Action.PREPARE,
        state
      )

      resultMessage = Utility.StreamingProtocol.createMessage(
        message.transferId,
        message.payeeFsp,
        message.payerFsp,
        metadata,
        headers,
        fspiopError,
        { id: message.transferId },
        'application/json'
      )
    }

    resultMessages.push(resultMessage)

    const transferStateChange = {
      transferStateId,
      reason
    }
    transferStateChanges.push(transferStateChange)

    const participantPositionChange = {
      transferStateChangeId: null, // Need to update this in bin processor while executing queries
      value: availablePosition,
      reservedValue: accumulatedPositionReservedValue
    }
    participantPositionChanges.push(participantPositionChange)

    if (availablePosition.toNumber() > liquidityCover.multiply(participantLimit.thresholdAlarmPercentage).toNumber()) {
      limitAlarms.push(participantLimit)
    }
  }
  return {
    accumulatedPosition: availablePosition,
    transferStateChanges,
    participantPositionChanges,
    resultMessages,
    accumulatedTransferStateChanges,
    limitAlarms
  }
}

module.exports = {
  processPositionPrepareBin
}
