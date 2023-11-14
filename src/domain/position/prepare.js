const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const resourceVersions = require('@mojaloop/central-services-shared').Util.resourceVersions
const MLNumber = require('@mojaloop/ml-number')
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function processPositionPrepareBin
 *
 * @async
 * @description This is the domain function to process a bin of position-prepare messages of a single participant account.
 *
 * @param {array} binItems - an array of objects that contain a position prepare message and its span. {message, span}
 * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @param {number} settlementParticipantPosition - position value of the participants settlement account
 * @param {object} settlementModel - settlement model object for the currency
 * @param {object} participantLimit - participant limit object for the currency
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionPrepareBin = async (
  binItems,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedTransferStates,
  settlementParticipantPosition,
  settlementModel,
  participantLimit
) => {
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const limitAlarms = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)

  let currentPosition = new MLNumber(accumulatedPositionValue)
  const reservedPosition = new MLNumber(accumulatedPositionReservedValue)
  const effectivePosition = new MLNumber(currentPosition.add(reservedPosition).toFixed(Config.AMOUNT.SCALE))
  const liquidityCover = new MLNumber(settlementParticipantPosition).multiply(-1)
  const payerLimit = new MLNumber(participantLimit.value)
  let availablePositionBasedOnLiquidityCover = new MLNumber(liquidityCover.subtract(effectivePosition).toFixed(Config.AMOUNT.SCALE))
  Logger.isInfoEnabled && Logger.info(`processPositionPrepareBin::availablePositionBasedOnLiquidityCover: ${availablePositionBasedOnLiquidityCover}`)
  let availablePositionBasedOnPayerLimit = new MLNumber(payerLimit.subtract(effectivePosition).toFixed(Config.AMOUNT.SCALE))
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::availablePositionBasedOnPayerLimit: ${availablePositionBasedOnPayerLimit}`)

  if (binItems && binItems.length > 0) {
    for (const binItem of binItems) {
      let transferStateId
      let reason
      let resultMessage
      const transfer = binItem.decodedPayload
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transfer:processingMessage: ${JSON.stringify(transfer)}`)

      // Check if transfer is in correct state for processing, produce an internal error message
      if (accumulatedTransferStates[transfer.transferId] !== Enum.Transfers.TransferInternalState.RECEIVED_PREPARE) {
        Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transferState: ${accumulatedTransferStates[transfer.transferId]} !== ${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`)

        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = 'Transfer in incorrect state'

        const headers = Utility.Http.SwitchDefaultHeaders(
          transfer.payerFsp,
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
          transfer.transferId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          transfer.transferId,
          transfer.payeeFsp,
          transfer.payerFsp,
          metadata,
          headers,
          fspiopError,
          { id: transfer.transferId },
          'application/json'
        )
        binItem.result = { success: false }
        // Check if payer has insufficient liquidity, produce an error message and abort transfer
      } else if (availablePositionBasedOnLiquidityCover.toNumber() < transfer.amount.amount) {
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY.message

        // const headers = Utility.Http.SwitchDefaultHeaders(
        //   transfer.payerFsp,
        //   Enum.Http.HeaderResources.TRANSFERS,
        //   Enum.Http.Headers.FSPIOP.SWITCH.value,
        //   resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion
        // )
        // forward same headers from the prepare message, except the content-length header
        const headers = { ...binItem.message.value.content.headers }
        delete headers['content-length']

        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY
        ).toApiErrorObject(Config.ERROR_HANDLING)
        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.FAILURE.status,
          fspiopError.errorInformation.errorCode,
          fspiopError.errorInformation.errorDescription
        )
        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          transfer.transferId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          transfer.transferId,
          transfer.payerFsp,
          Enum.Http.Headers.FSPIOP.SWITCH.value,
          metadata,
          headers,
          fspiopError,
          { id: transfer.transferId },
          'application/json'
        )
        binItem.result = { success: false }
        // Check if payer has surpassed their limit, produce an error message and abort transfer
      } else if (availablePositionBasedOnPayerLimit.toNumber() < transfer.amount.amount) {
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.message

        const headers = Utility.Http.SwitchDefaultHeaders(
          transfer.payerFsp,
          Enum.Http.HeaderResources.TRANSFERS,
          Enum.Http.Headers.FSPIOP.SWITCH.value,
          resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion
        )
        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR
        ).toApiErrorObject(Config.ERROR_HANDLING)

        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.FAILURE.status,
          fspiopError.errorInformation.errorCode,
          fspiopError.errorInformation.errorDescription
        )

        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          transfer.transferId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          transfer.transferId,
          transfer.payeeFsp,
          transfer.payerFsp,
          metadata,
          headers,
          fspiopError,
          { id: transfer.transferId },
          'application/json'
        )
        binItem.result = { success: false }
        // Payer has sufficient liquidity and limit
      } else {
        transferStateId = Enum.Transfers.TransferState.RESERVED
        currentPosition = currentPosition.add(transfer.amount.amount)
        availablePositionBasedOnLiquidityCover = availablePositionBasedOnLiquidityCover.add(transfer.amount.amount)
        availablePositionBasedOnPayerLimit = availablePositionBasedOnPayerLimit.add(transfer.amount.amount)
        
        // forward same headers from the prepare message, except the content-length header
        const headers = { ...binItem.message.value.content.headers }
        delete headers['content-length']
        
        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.SUCCESS.status,
          null,
          null
        )
        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          transfer.transferId,
          Enum.Kafka.Topics.TRANSFER,
          Enum.Events.Event.Action.PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          transfer.transferId,
          transfer.payeeFsp,
          transfer.payerFsp,
          metadata,
          headers,
          transfer,
          {},
          'application/json'
        )

        const participantPositionChange = {
          transferId: transfer.transferId, // Need to delete this in bin processor while updating transferStateChangeId
          transferStateChangeId: null, // Need to update this in bin processor while executing queries
          value: currentPosition.toNumber(),
          reservedValue: accumulatedPositionReservedValue
        }
        participantPositionChanges.push(participantPositionChange)
        Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)
        binItem.result = { success: true }
      }

      resultMessages.push({ binItem, message: resultMessage })

      const transferStateChange = {
        transferId: transfer.transferId,
        transferStateId,
        reason
      }
      transferStateChanges.push(transferStateChange)
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transferStateChange: ${JSON.stringify(transferStateChange)}`)

      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::limitAlarm: ${currentPosition.toNumber()} > ${liquidityCover.multiply(participantLimit.thresholdAlarmPercentage)}`)
      if (currentPosition.toNumber() > liquidityCover.multiply(participantLimit.thresholdAlarmPercentage).toNumber()) {
        limitAlarms.push(participantLimit)
      }

      accumulatedTransferStatesCopy[transfer.transferId] = transferStateId
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::accumulatedTransferStatesCopy:finalizedTransferState ${JSON.stringify(transferStateId)}`)
    }
  }

  return {
    accumulatedPositionValue: currentPosition.toNumber(),
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after prepare processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    limitAlarms, // array of participant limits that have been breached
    accumulatedPositionChanges: participantPositionChanges, // participant position changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

module.exports = {
  processPositionPrepareBin
}
