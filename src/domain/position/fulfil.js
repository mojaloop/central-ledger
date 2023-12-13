const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const MLNumber = require('@mojaloop/ml-number')
const Logger = require('@mojaloop/central-services-logger')
const TransferObjectTransform = require('../../domain/transfer/transform')

/**
 * @function processPositionFulfilBin
 *
 * @async
 * @description This is the domain function to process a bin of position-fulfil messages of a single participant account.
 *
 * @param {array} commitReserveFulfilBins - an array containing commit and reserve action bins
 * @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 * @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 * @param {object} accumulatedTransferStates - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionFulfilBin = async (
  commitReserveFulfilBins,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedTransferStates,
  transferInfoList,
  reservedActionTransfers
) => {
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const accumulatedTransferStatesCopy = Object.assign({}, accumulatedTransferStates)
  let runningPosition = new MLNumber(accumulatedPositionValue)

  for (const binItems of commitReserveFulfilBins) {
    if (binItems && binItems.length > 0) {
      for (const binItem of binItems) {
        let transferStateId
        let reason
        let resultMessage
        const transferId = binItem.message.value.content.uriParams.id
        const payeeFsp = binItem.message.value.from
        const payerFsp = binItem.message.value.to
        const transfer = binItem.decodedPayload
        Logger.isDebugEnabled && Logger.debug(`processPositionFulfilBin::transfer:processingMessage: ${JSON.stringify(transfer)}`)
        Logger.isDebugEnabled && Logger.debug(`accumulatedTransferStates: ${JSON.stringify(accumulatedTransferStates)}`)
        // Inform payee dfsp if transfer is not in RECEIVED_FULFIL state, skip making any transfer state changes
        if (accumulatedTransferStates[transferId] !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
          // forward same headers from the prepare message, except the content-length header
          // set destination to payeefsp and source to switch
          const headers = { ...binItem.message.value.content.headers }
          headers[Enum.Http.Headers.FSPIOP.DESTINATION] = payeeFsp
          headers[Enum.Http.Headers.FSPIOP.SOURCE] = Enum.Http.Headers.FSPIOP.SWITCH.value
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

          resultMessage = Utility.StreamingProtocol.createMessage(
            transferId,
            payeeFsp,
            Enum.Http.Headers.FSPIOP.SWITCH.value,
            metadata,
            headers,
            fspiopError,
            { id: transferId },
            'application/json'
          )
        } else {
          const transferInfo = transferInfoList[transferId]

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

          resultMessage = Utility.StreamingProtocol.createMessage(
            transferId,
            payerFsp,
            payeeFsp,
            metadata,
            headers,
            transfer,
            { id: transferId },
            'application/json'
          )

          if (binItem.message.value.metadata.event.action === Enum.Events.Event.Action.RESERVE) {
            resultMessage.content.payload = TransferObjectTransform.toFulfil(
              reservedActionTransfers[transferId]
            )
          }

          transferStateId = Enum.Transfers.TransferState.COMMITTED
          // Amounts in `transferParticipant` for the payee are stored as negative values
          runningPosition = new MLNumber(runningPosition.add(transferInfo.amount).toFixed(Config.AMOUNT.SCALE))

          const participantPositionChange = {
            transferId, // Need to delete this in bin processor while updating transferStateChangeId
            transferStateChangeId: null, // Need to update this in bin processor while executing queries
            value: runningPosition.toNumber(),
            reservedValue: accumulatedPositionReservedValue
          }
          participantPositionChanges.push(participantPositionChange)
          binItem.result = { success: true }
        }

        resultMessages.push({ binItem, message: resultMessage })

        if (transferStateId) {
          const transferStateChange = {
            transferId,
            transferStateId,
            reason
          }
          transferStateChanges.push(transferStateChange)
          Logger.isDebugEnabled && Logger.debug(`processPositionFulfilBin::transferStateChange: ${JSON.stringify(transferStateChange)}`)

          accumulatedTransferStatesCopy[transferId] = transferStateId
          Logger.isDebugEnabled && Logger.debug(`processPositionFulfilBin::accumulatedTransferStatesCopy:finalizedTransferState ${JSON.stringify(transferStateId)}`)
        }
      }
    }
  }

  return {
    accumulatedPositionValue: runningPosition.toNumber(),
    accumulatedTransferStates: accumulatedTransferStatesCopy, // finalized transfer state after fulfil processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    accumulatedPositionChanges: participantPositionChanges, // participant position changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

module.exports = {
  processPositionFulfilBin
}
