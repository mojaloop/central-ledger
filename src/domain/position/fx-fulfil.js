const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const Logger = require('@mojaloop/central-services-logger')

/**
 * @function processPositionFxFulfilBin
 *
 * @async
 * @description This is the domain function to process a bin of position-fx-fulfil messages of a single participant account.
 *
 * @param {array} binItems - an array of objects that contain a position fx reserve message and its span. {message, span}
 * @param {object} accumulatedFxTransferStates - object with fx transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 * @param {object} transferInfoList - object with transfer id keys and transfer info values. Used to pass transfer info to domain function.
 * @returns {object} - Returns an object containing accumulatedFxTransferStateChanges, accumulatedFxTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionFxFulfilBin = async (
  binItems,
  accumulatedFxTransferStates,
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
      // Inform sender if transfer is not in RECEIVED_FULFIL state, skip making any transfer state changes
      if (accumulatedFxTransferStates[commitRequestId] !== Enum.Transfers.TransferInternalState.RECEIVED_FULFIL) {
        // forward same headers from the request, except the content-length header
        // set destination to counterPartyFsp and source to switch
        const headers = { ...binItem.message.value.content.headers }
        headers[Enum.Http.Headers.FSPIOP.DESTINATION] = counterPartyFsp
        headers[Enum.Http.Headers.FSPIOP.SOURCE] = Enum.Http.Headers.FSPIOP.SWITCH.value
        delete headers['content-length']

        // TODO: Confirm if this setting transferStateId to ABORTED_REJECTED is correct. There is no such logic in the fulfil handler.
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = 'FxFulfil in incorrect state'

        const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(
          `Invalid State: ${accumulatedFxTransferStates[commitRequestId]} - expected: ${Enum.Transfers.TransferInternalState.RECEIVED_FULFIL}`
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
          Enum.Http.Headers.FSPIOP.SWITCH.value,
          metadata,
          headers,
          fspiopError,
          { id: commitRequestId },
          'application/json'
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
          'application/json'
        )

        transferStateId = Enum.Transfers.TransferState.COMMITTED

        binItem.result = { success: true }
      }

      resultMessages.push({ binItem, message: resultMessage })

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
