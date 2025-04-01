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
 * @function processFxPositionPrepareBin
 *
 * @async
 * @description This is the domain function to process a bin of position-prepare messages of a single participant account.
 *
 * @param {array} binItems - an array of objects that contain a position prepare message and its span. {message, decodedPayload, span}
 * @param {object} options
 *   @param {number} accumulatedPositionValue - value of position accumulated so far from previous bin processing
 *   @param {number} accumulatedPositionReservedValue - value of position reserved accumulated so far, not used but kept for consistency
 *   @param {object} accumulatedFxTransferStates - object with fx commit request id keys and fx transfer state id values. Used to check if fx transfer is in correct state for processing. Clone and update states for output.
 *   @param {number} settlementParticipantPosition - position value of the participants settlement account
 *   @param {object} participantLimit - participant limit object for the currency
 *   @param {boolean} changePositions - whether to change positions or not
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedFxTransferStateChanges, accumulatedTransferStates, resultMessages, limitAlarms or throws an error if failed
 */
const processFxPositionPrepareBin = async (
  binItems,
  {
    accumulatedPositionValue,
    accumulatedPositionReservedValue,
    accumulatedFxTransferStates,
    settlementParticipantPosition,
    participantLimit,
    changePositions = true
  }
) => {
  const fxTransferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const limitAlarms = []
  const accumulatedFxTransferStatesCopy = Object.assign({}, accumulatedFxTransferStates)

  let currentPosition = new MLNumber(accumulatedPositionValue)
  let liquidityCover = 0
  let availablePositionBasedOnLiquidityCover = 0
  let availablePositionBasedOnPayerLimit = 0

  if (changePositions) {
    const reservedPosition = new MLNumber(accumulatedPositionReservedValue)
    const effectivePosition = new MLNumber(currentPosition.add(reservedPosition).toFixed(Config.AMOUNT.SCALE))
    const payerLimit = new MLNumber(participantLimit.value)
    liquidityCover = new MLNumber(settlementParticipantPosition).multiply(-1)
    availablePositionBasedOnLiquidityCover = new MLNumber(liquidityCover.subtract(effectivePosition).toFixed(Config.AMOUNT.SCALE))
    Logger.isInfoEnabled && Logger.info(`processFxPositionPrepareBin::availablePositionBasedOnLiquidityCover: ${availablePositionBasedOnLiquidityCover}`)
    availablePositionBasedOnPayerLimit = new MLNumber(payerLimit.subtract(effectivePosition).toFixed(Config.AMOUNT.SCALE))
    Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::availablePositionBasedOnPayerLimit: ${availablePositionBasedOnPayerLimit}`)
  }

  if (binItems && binItems.length > 0) {
    for (const binItem of binItems) {
      let transferStateId
      let reason
      let resultMessage
      const fxTransfer = binItem.decodedPayload
      const cyrilResult = binItem.message.value.content.context.cyrilResult
      const transferAmount = fxTransfer.targetAmount.currency === cyrilResult.currencyId ? fxTransfer.targetAmount.amount : fxTransfer.sourceAmount.amount

      Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::transfer:processingMessage: ${JSON.stringify(fxTransfer)}`)

      /* eslint-disable brace-style */
      // Check if fxTransfer is in correct state for processing, produce an internal error message
      if (accumulatedFxTransferStates[fxTransfer.commitRequestId] !== Enum.Transfers.TransferInternalState.RECEIVED_PREPARE) {
        Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::transferState: ${accumulatedFxTransferStates[fxTransfer.commitRequestId]} !== ${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`)

        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = 'FxTransfer in incorrect state'

        // forward same headers from the prepare message, except the content-length header
        // set destination to initiatingFsp and source to switch
        const headers = { ...binItem.message.value.content.headers }
        headers[Enum.Http.Headers.FSPIOP.DESTINATION] = fxTransfer.initiatingFsp
        headers[Enum.Http.Headers.FSPIOP.SOURCE] = Config.HUB_NAME
        delete headers['content-length']

        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR
        ).toApiErrorObject(Config.ERROR_HANDLING)

        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.FAILURE.status,
          fspiopError.errorInformation.errorCode,
          fspiopError.errorInformation.errorDescription
        )

        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          fxTransfer.commitRequestId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.FX_PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          fxTransfer.commitRequestId,
          fxTransfer.initiatingFsp,
          Config.HUB_NAME,
          metadata,
          headers,
          fspiopError,
          { id: fxTransfer.commitRequestId },
          'application/json',
          binItem.message.value.content.context
        )

        binItem.result = { success: false }
      }
      // Check if payer has insufficient liquidity, produce an error message and abort transfer
      else if (changePositions && availablePositionBasedOnLiquidityCover.toNumber() < transferAmount) {
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY.message

        // forward same headers from the prepare message, except the content-length header
        // set destination to payerfsp and source to switch
        const headers = { ...binItem.message.value.content.headers }
        headers[Enum.Http.Headers.FSPIOP.DESTINATION] = fxTransfer.initiatingFsp
        headers[Enum.Http.Headers.FSPIOP.SOURCE] = Config.HUB_NAME
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
          fxTransfer.commitRequestId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.FX_PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          fxTransfer.commitRequestId,
          fxTransfer.initiatingFsp,
          Config.HUB_NAME,
          metadata,
          headers,
          fspiopError,
          { id: fxTransfer.commitRequestId },
          'application/json',
          binItem.message.value.content.context
        )

        binItem.result = { success: false }
      }
      // Check if payer has surpassed their limit, produce an error message and abort transfer
      else if (changePositions && availablePositionBasedOnPayerLimit.toNumber() < transferAmount) {
        transferStateId = Enum.Transfers.TransferInternalState.ABORTED_REJECTED
        reason = ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.message

        // forward same headers from the prepare message, except the content-length header
        // set destination to payerfsp and source to switch
        const headers = { ...binItem.message.value.content.headers }
        headers[Enum.Http.Headers.FSPIOP.DESTINATION] = fxTransfer.initiatingFsp
        headers[Enum.Http.Headers.FSPIOP.SOURCE] = Config.HUB_NAME
        delete headers['content-length']

        const fspiopError = ErrorHandler.Factory.createFSPIOPError(
          ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR
        ).toApiErrorObject(Config.ERROR_HANDLING)

        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.FAILURE.status,
          fspiopError.errorInformation.errorCode,
          fspiopError.errorInformation.errorDescription
        )

        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          fxTransfer.commitRequestId,
          Enum.Kafka.Topics.NOTIFICATION,
          Enum.Events.Event.Action.FX_PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          fxTransfer.commitRequestId,
          fxTransfer.initiatingFsp,
          Config.HUB_NAME,
          metadata,
          headers,
          fspiopError,
          { id: fxTransfer.commitRequestId },
          'application/json',
          binItem.message.value.content.context
        )

        binItem.result = { success: false }
      }
      // Payer has sufficient liquidity and limit
      else {
        transferStateId = Enum.Transfers.TransferInternalState.RESERVED

        if (changePositions) {
          currentPosition = currentPosition.add(transferAmount)
          availablePositionBasedOnLiquidityCover = availablePositionBasedOnLiquidityCover.add(transferAmount)
          availablePositionBasedOnPayerLimit = availablePositionBasedOnPayerLimit.add(transferAmount)
          const participantPositionChange = {
            commitRequestId: fxTransfer.commitRequestId, // Need to delete this in bin processor while updating fxTransferStateChangeId
            fxTransferStateChangeId: null, // Need to update this in bin processor while executing queries
            value: currentPosition.toNumber(),
            change: transferAmount,
            reservedValue: accumulatedPositionReservedValue
          }
          participantPositionChanges.push(participantPositionChange)
          Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)
        }

        // forward same headers from the prepare message, except the content-length header
        const headers = { ...binItem.message.value.content.headers }
        delete headers['content-length']

        const state = Utility.StreamingProtocol.createEventState(
          Enum.Events.EventStatus.SUCCESS.status,
          null,
          null
        )
        const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(
          fxTransfer.commitRequestId,
          Enum.Kafka.Topics.TRANSFER,
          Enum.Events.Event.Action.FX_PREPARE,
          state
        )

        resultMessage = Utility.StreamingProtocol.createMessage(
          fxTransfer.commitRequestId,
          fxTransfer.counterPartyFsp,
          fxTransfer.initiatingFsp,
          metadata,
          headers,
          fxTransfer,
          {},
          'application/json',
          binItem.message.value.content.context
        )

        binItem.result = { success: true }
      }

      resultMessages.push({ binItem, message: Utility.clone(resultMessage) })

      if (changePositions) {
        Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::limitAlarm: ${currentPosition.toNumber()} > ${liquidityCover.multiply(participantLimit.thresholdAlarmPercentage)}`)
        if (currentPosition.toNumber() > liquidityCover.multiply(participantLimit.thresholdAlarmPercentage).toNumber()) {
          limitAlarms.push(participantLimit)
        }
      }

      const fxTransferStateChange = {
        commitRequestId: fxTransfer.commitRequestId,
        transferStateId,
        reason
      }
      fxTransferStateChanges.push(fxTransferStateChange)
      Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::fxTransferStateChange: ${JSON.stringify(fxTransferStateChange)}`)

      accumulatedFxTransferStatesCopy[fxTransfer.commitRequestId] = transferStateId
      Logger.isDebugEnabled && Logger.debug(`processFxPositionPrepareBin::accumulatedTransferStatesCopy:finalizedTransferState ${JSON.stringify(transferStateId)}`)
    }
  }

  return {
    accumulatedPositionValue: changePositions ? currentPosition.toNumber() : accumulatedPositionValue,
    accumulatedFxTransferStates: accumulatedFxTransferStatesCopy, // finalized transfer state after prepare processing
    accumulatedPositionReservedValue, // not used but kept for consistency
    accumulatedFxTransferStateChanges: fxTransferStateChanges, // fx-transfer state changes to be persisted in order
    limitAlarms, // array of participant limits that have been breached
    accumulatedPositionChanges: changePositions ? participantPositionChanges : [], // participant position changes to be persisted in order
    notifyMessages: resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

module.exports = {
  processFxPositionPrepareBin
}
