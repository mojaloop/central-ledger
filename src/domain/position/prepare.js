const { Enum } = require('@mojaloop/central-services-shared')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('../../lib/config')
const Utility = require('@mojaloop/central-services-shared').Util
const resourceVersions = require('@mojaloop/central-services-shared').Util.resourceVersions
const MLNumber = require('@mojaloop/ml-number')
const SettlementModelCached = require('../../models/settlement/settlementModelCached')
const ParticipantFacade = require('../../models/participant/facade')
const BatchModel = require('../../models/position/batch')
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
 * @param {object} accumulatedTransferState - object with transfer id keys and transfer state id values. Used to check if transfer is in correct state for processing. Clone and update states for output.
 *
 * @returns {object} - Returns an object containing accumulatedPositionValue, accumulatedPositionReservedValue, accumulatedTransferStateChanges, accumulatedTransferState, resultMessages, limitAlarms or throws an error if failed
 */
const processPositionPrepareBin = async (
  binItems,
  accumulatedPositionValue,
  accumulatedPositionReservedValue,
  accumulatedTransferState
) => {
  let availablePosition
  const transferStateChanges = []
  const participantPositionChanges = []
  const resultMessages = []
  const limitAlarms = []
  const accumulatedTransferStateCopy = Object.assign({}, accumulatedTransferState)
  const effectivePosition = new MLNumber(accumulatedPositionValue + accumulatedPositionReservedValue)
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::effectivePosition: ${effectivePosition}`)

  // Bin items should be grouped by participant currency id so lets use the first one
  const participantName = binItems[0].message.payload.payerFsp
  const currencyId = binItems[0].message.payload.amount.currency

  // This most likely is a shared query that should be moved to the bin processor
  const participantCurrency = await ParticipantFacade.getByNameAndCurrency(
    participantName,
    currencyId,
    Enum.Accounts.LedgerAccountType.POSITION
  )
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::participantCurrency: ${JSON.stringify(participantCurrency)}`)

  const participantLimit = await ParticipantFacade.getParticipantLimitByParticipantCurrencyLimit(
    participantCurrency.participantId,
    participantCurrency.currencyId,
    Enum.Accounts.LedgerAccountType.POSITION,
    Enum.Accounts.ParticipantLimitType.NET_DEBIT_CAP
  )
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::participantLimit: ${JSON.stringify(participantLimit)}`)

  // Query the settlement models to get the settlement delay
  const allSettlementModels = await SettlementModelCached.getAll()
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::allSettlementModels: ${JSON.stringify(allSettlementModels)}`)

  let settlementModels = allSettlementModels.filter(model => model.currencyId === currencyId)
  if (settlementModels.length === 0) {
    settlementModels = allSettlementModels.filter(model => model.currencyId === null) // Default settlement model
    if (settlementModels.length === 0) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.GENERIC_SETTLEMENT_ERROR, 'Unable to find a matching or default, Settlement Model')
    }
  }
  const settlementModel = settlementModels.find(sm => sm.ledgerAccountTypeId === Enum.Accounts.LedgerAccountType.POSITION)
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::settlementModel: ${JSON.stringify(settlementModel)}`)

  const settlementParticipantCurrency = await ParticipantFacade.getByNameAndCurrency(participantName, currencyId, settlementModel.settlementAccountTypeId)
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::settlementParticipantCurrency: ${JSON.stringify(settlementParticipantCurrency)}`)

  const participantPositions = await BatchModel.getPositionsByAccountIdsNonTrx(
    [participantCurrency.participantCurrencyId, settlementParticipantCurrency.participantCurrencyId]
  )
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::participantPositions: ${JSON.stringify(participantPositions)}`)

  const settlementParticipantPosition = participantPositions[settlementParticipantCurrency.participantCurrencyId]
  Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::settlementParticipantPosition: ${settlementParticipantPosition}`)

  // Calculate the available position, how much funds the payer participant can move, based on the settlement model delay
  if (settlementModel.settlementDelayId === Enum.Settlements.SettlementDelay.IMMEDIATE) {
    availablePosition = new MLNumber(settlementParticipantPosition + participantLimit.value - effectivePosition)
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::availablePosition: ${availablePosition} = ${settlementParticipantPosition} + ${participantLimit.value} - ${effectivePosition}`)
  } else {
    availablePosition = new MLNumber(participantLimit.value - effectivePosition)
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::availablePosition: ${availablePosition} = ${participantLimit.value} - ${effectivePosition}`)
  }

  for (const binItem of binItems) {
    let transferStateId
    let reason
    let resultMessage
    const transfer = binItem.message.payload
    Logger.isDebugEnabled && Logger.debug('-'.repeat(100))
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transfer:processingMessage: ${JSON.stringify(transfer)}`)

    // Check if transfer is in correct state for processing, produce an internal error message
    if (accumulatedTransferState[transfer.transferId] !== Enum.Transfers.TransferInternalState.RECEIVED_PREPARE) {
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transferState: ${accumulatedTransferState[transfer.transferId]} !== ${Enum.Transfers.TransferInternalState.RECEIVED_PREPARE}`)

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
    // Check if payer participant has sufficient liquidity to process the transfer, produce success message
    } else if (availablePosition.toNumber() >= transfer.amount.amount) {
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::availablePosition: ${availablePosition} >= ${transfer.amount.amount}`)

      transferStateId = Enum.Transfers.TransferState.RESERVED
      availablePosition = availablePosition.subtract(transfer.amount.amount)

      // Are these the right headers?
      const headers = Utility.Http.SwitchDefaultHeaders(
        transfer.payeeFsp,
        Enum.Http.HeaderResources.TRANSFERS,
        transfer.payerFsp,
        resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion
      )
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
        null,
        { id: transfer.transferId },
        'application/json'
      )
    // Payer participant has insufficient liquidity to process the transfer, produce an abort message
    } else {
      transferStateId = Enum.Transfers.TransferState.ABORTED
      reason = 'Payer FSP insufficient liquidity'

      const headers = Utility.Http.SwitchDefaultHeaders(
        transfer.payerFsp,
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
    }

    resultMessages.push({ binItem, message: resultMessage })

    const transferStateChange = {
      transferId: transfer.transferId,
      transferStateId,
      reason
    }
    transferStateChanges.push(transferStateChange)
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::transferStateChange: ${JSON.stringify(transferStateChange)}`)

    const participantPositionChange = {
      transferStateChangeId: null, // Need to update this in bin processor while executing queries
      value: availablePosition.toNumber(),
      reservedValue: accumulatedPositionReservedValue
    }
    participantPositionChanges.push(participantPositionChange)
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::participantPositionChange: ${JSON.stringify(participantPositionChange)}`)

    // Logic here seems to be faulty. Pulled from position model.
    // Think this should be a positive number?
    const liquidityCover = new MLNumber(settlementParticipantPosition).multiply(-1)
    if (availablePosition.toNumber() > liquidityCover.multiply(participantLimit.thresholdAlarmPercentage).toNumber()) {
      Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::limitAlarm: ${availablePosition} > ${liquidityCover.multiply(participantLimit.thresholdAlarmPercentage)}`)
      limitAlarms.push(participantLimit)
    }

    accumulatedTransferStateCopy[transfer.transferId] = transferStateId
    Logger.isDebugEnabled && Logger.debug(`processPositionPrepareBin::accumulatedTransferStateCopy:finalizedTransferState ${JSON.stringify(transferStateId)}`)
    Logger.isDebugEnabled && Logger.debug('-'.repeat(100))
  }

  return {
    accumulatedPosition: availablePosition.toNumber(),
    accumulatedTransferState: accumulatedTransferStateCopy, // finalized transfer state after prepare processing
    accumulatedTransferStateChanges: transferStateChanges, // transfer state changes to be persisted in order
    limitAlarms, // array of participant limits that have been breached
    participantPositionChanges, // participant position changes to be persisted in order
    resultMessages // array of objects containing bin item and result message. {binItem, message}
  }
}

module.exports = {
  processPositionPrepareBin
}
