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

  * ModusBox
  - Georgi Georgiev <georgi.georgiev@modusbox.com>
  - Rajiv Mothilal <rajiv.mothilal@modusbox.com>

  --------------
  ******/
'use strict'

/**
  * @module src/handlers/timeout
  */

const CronJob = require('cron').CronJob
const Enum = require('@mojaloop/central-services-shared').Enum
const Utility = require('@mojaloop/central-services-shared').Util
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const EventSdk = require('@mojaloop/event-sdk')

const Config = require('../../lib/config')
const TimeoutService = require('../../domain/timeout')
const { logger } = require('../../shared/logger')

const { Kafka, resourceVersions, rethrow } = Utility
const { Action, Type } = Enum.Events.Event

let timeoutJob
let isRegistered
let running = false

/**
 * Processes timedOut transfers
 *
 * @param {TimedOutTransfer[]} transferTimeoutList
 * @returns {Promise<void>}
 */
const _processTimedOutTransfers = async (transferTimeoutList) => {
  const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED).toApiErrorObject(Config.ERROR_HANDLING)
  if (!Array.isArray(transferTimeoutList)) {
    transferTimeoutList = [
      { ...transferTimeoutList }
    ]
  }

  for (const TT of transferTimeoutList) {
    const span = EventSdk.Tracer.createSpan('cl_transfer_timeout')
    try {
      const state = Utility.StreamingProtocol.createEventState(Enum.Events.EventStatus.FAILURE.status, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription)
      const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(TT.transferId, Enum.Kafka.Topics.NOTIFICATION, Action.TIMEOUT_RECEIVED, state)
      const destination = TT.externalPayerName || TT.payerFsp
      const source = TT.externalPayeeName || TT.payeeFsp
      const headers = Utility.Http.SwitchDefaultHeaders(destination, Enum.Http.HeaderResources.TRANSFERS, Config.HUB_NAME, resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion)
      const message = Utility.StreamingProtocol.createMessage(TT.transferId, destination, source, metadata, headers, fspiopError, { id: TT.transferId }, `application/vnd.interoperability.${Enum.Http.HeaderResources.TRANSFERS}+json;version=${resourceVersions[Enum.Http.HeaderResources.TRANSFERS].contentVersion}`)
      // Pass payer and payee names to the context for notification functionality
      message.content.context = {
        payer: TT.externalPayerName || TT.payerFsp,
        payee: TT.externalPayeeName || TT.payeeFsp
      }

      span.setTags(Utility.EventFramework.getTransferSpanTags({ payload: message.content.payload, headers }, Type.TRANSFER, Action.TIMEOUT_RECEIVED))
      await span.audit({
        state,
        metadata,
        headers,
        message
      }, EventSdk.AuditEventAction.start)

      if (TT.bulkTransferId === null) { // regular transfer
        if (TT.transferStateId === Enum.Transfers.TransferInternalState.EXPIRED_PREPARED) {
          message.from = Config.HUB_NAME
          // event & type set above when `const metadata` is initialized to NOTIFICATION / TIMEOUT_RECEIVED
          await Kafka.produceGeneralMessage(
            Config.KAFKA_CONFIG,
            Producer,
            Enum.Kafka.Topics.NOTIFICATION,
            Action.TIMEOUT_RECEIVED,
            message,
            state,
            null,
            span
          )
        } else if (TT.transferStateId === Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
          message.from = Config.HUB_NAME
          message.metadata.event.type = Type.POSITION
          message.metadata.event.action = Action.TIMEOUT_RESERVED
          // Key position timeouts with payer account id
          await Kafka.produceGeneralMessage(
            Config.KAFKA_CONFIG,
            Producer,
            Enum.Kafka.Topics.POSITION,
            Action.TIMEOUT_RESERVED,
            message,
            state,
            TT.effectedParticipantCurrencyId?.toString(),
            span,
            Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.TIMEOUT_RESERVED
          )
        }
      } else { // individual transfer from a bulk
        if (TT.transferStateId === Enum.Transfers.TransferInternalState.EXPIRED_PREPARED) {
          message.from = Config.HUB_NAME
          message.metadata.event.type = Type.BULK_PROCESSING
          message.metadata.event.action = Action.BULK_TIMEOUT_RECEIVED
          await Kafka.produceGeneralMessage(
            Config.KAFKA_CONFIG,
            Producer,
            Enum.Kafka.Topics.BULK_PROCESSING,
            Action.BULK_TIMEOUT_RECEIVED,
            message,
            state,
            null,
            span
          )
        } else if (TT.transferStateId === Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
          message.metadata.event.type = Type.POSITION
          message.metadata.event.action = Action.BULK_TIMEOUT_RESERVED
          // Key position timeouts with payer account id
          await Kafka.produceGeneralMessage(
            Config.KAFKA_CONFIG,
            Producer,
            Enum.Kafka.Topics.POSITION,
            Action.BULK_TIMEOUT_RESERVED,
            message,
            state,
            TT.payerParticipantCurrencyId?.toString(),
            span
          )
        }
      }
    } catch (err) {
      logger.error('error in _processTimedOutTransfers:', err)
      const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      await span.error(fspiopError, state)
      await span.finish(fspiopError.message, state)
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: '_processTimedOutTransfers' })
    } finally {
      if (!span.isFinished) {
        await span.finish()
      }
    }
  }
}

/**
 * Processes timedOut fxTransfers
 *
 * @param {TimedOutFxTransfer[]} fxTransferTimeoutList
 * @returns {Promise<void>}
 */
const _processFxTimedOutTransfers = async (fxTransferTimeoutList) => {
  const fspiopError = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED).toApiErrorObject(Config.ERROR_HANDLING)
  if (!Array.isArray(fxTransferTimeoutList)) {
    fxTransferTimeoutList = [
      { ...fxTransferTimeoutList }
    ]
  }
  for (const fTT of fxTransferTimeoutList) {
    const span = EventSdk.Tracer.createSpan('cl_fx_transfer_timeout')
    try {
      const state = Utility.StreamingProtocol.createEventState(Enum.Events.EventStatus.FAILURE.status, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription)
      const metadata = Utility.StreamingProtocol.createMetadataWithCorrelatedEvent(fTT.commitRequestId, Enum.Kafka.Topics.NOTIFICATION, Action.FX_TIMEOUT_RECEIVED, state)
      const destination = fTT.externalInitiatingFspName || fTT.initiatingFsp
      const source = fTT.externalCounterPartyFspName || fTT.counterPartyFsp
      const headers = Utility.Http.SwitchDefaultHeaders(destination, Enum.Http.HeaderResources.FX_TRANSFERS, Config.HUB_NAME, resourceVersions[Enum.Http.HeaderResources.FX_TRANSFERS].contentVersion)
      const message = Utility.StreamingProtocol.createMessage(fTT.commitRequestId, destination, source, metadata, headers, fspiopError, { id: fTT.commitRequestId }, `application/vnd.interoperability.${Enum.Http.HeaderResources.FX_TRANSFERS}+json;version=${resourceVersions[Enum.Http.HeaderResources.FX_TRANSFERS].contentVersion}`)
      // Pass payer and payee names to the context for notification functionality
      message.content.context = {
        payer: fTT.externalInitiatingFspName || fTT.initiatingFsp,
        payee: fTT.externalCounterPartyFspName || fTT.counterPartyFsp
      }

      span.setTags(Utility.EventFramework.getTransferSpanTags({ payload: message.content.payload, headers }, Type.FX_TRANSFER, Action.TIMEOUT_RECEIVED))
      await span.audit({
        state,
        metadata,
        headers,
        message
      }, EventSdk.AuditEventAction.start)

      if (fTT.transferStateId === Enum.Transfers.TransferInternalState.EXPIRED_PREPARED) {
        message.from = Config.HUB_NAME
        // event & type set above when `const metadata` is initialized to NOTIFICATION / FX_TIMEOUT_RECEIVED
        await Kafka.produceGeneralMessage(
          Config.KAFKA_CONFIG,
          Producer,
          Enum.Kafka.Topics.NOTIFICATION,
          Action.FX_TIMEOUT_RECEIVED,
          message,
          state,
          null,
          span
        )
      } else if (fTT.transferStateId === Enum.Transfers.TransferInternalState.RESERVED_TIMEOUT) {
        message.from = Config.HUB_NAME
        message.metadata.event.type = Type.POSITION
        message.metadata.event.action = Action.FX_TIMEOUT_RESERVED
        // Key position timeouts with payer account id
        await Kafka.produceGeneralMessage(
          Config.KAFKA_CONFIG,
          Producer,
          Enum.Kafka.Topics.POSITION,
          Action.FX_TIMEOUT_RESERVED,
          message,
          state,
          fTT.effectedParticipantCurrencyId?.toString(),
          span,
          Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.FX_TIMEOUT_RESERVED
        )
      }
    } catch (err) {
      logger.error('error in _processFxTimedOutTransfers:', err)
      const fspiopError = ErrorHandler.Factory.reformatFSPIOPError(err)
      const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
      await span.error(fspiopError, state)
      await span.finish(fspiopError.message, state)
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: '_processFxTimedOutTransfers' })
    } finally {
      if (!span.isFinished) {
        await span.finish()
      }
    }
  }
}

/**
  * @function TransferTimeoutHandler
  *
  * @async
  * @description This is the consumer callback function that gets registered to a cron job.
  *
  * ... called to validate/insert ...
  *
  * @param {error} error - error thrown if something fails within Cron
  *
  * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
  */
const timeout = async () => {
  if (running) return
  try {
    running = true
    const timeoutSegment = await TimeoutService.getTimeoutSegment()
    const intervalMin = timeoutSegment ? timeoutSegment.value : 0
    const segmentId = timeoutSegment ? timeoutSegment.segmentId : 0
    const cleanup = await TimeoutService.cleanupTransferTimeout()
    const latestTransferStateChange = await TimeoutService.getLatestTransferStateChange()

    const fxTimeoutSegment = await TimeoutService.getFxTimeoutSegment()
    const intervalMax = (latestTransferStateChange && parseInt(latestTransferStateChange.transferStateChangeId)) || 0
    const fxIntervalMin = fxTimeoutSegment ? fxTimeoutSegment.value : 0
    const fxSegmentId = fxTimeoutSegment ? fxTimeoutSegment.segmentId : 0
    const fxCleanup = await TimeoutService.cleanupFxTransferTimeout()
    const latestFxTransferStateChange = await TimeoutService.getLatestFxTransferStateChange()
    const fxIntervalMax = (latestFxTransferStateChange && parseInt(latestFxTransferStateChange.fxTransferStateChangeId)) || 0

    const { transferTimeoutList, fxTransferTimeoutList } = await TimeoutService.timeoutExpireReserved(segmentId, intervalMin, intervalMax, fxSegmentId, fxIntervalMin, fxIntervalMax)
    transferTimeoutList && await _processTimedOutTransfers(transferTimeoutList)
    fxTransferTimeoutList && await _processFxTimedOutTransfers(fxTransferTimeoutList)

    return {
      intervalMin,
      cleanup,
      intervalMax,
      fxIntervalMin,
      fxCleanup,
      fxIntervalMax,
      transferTimeoutList,
      fxTransferTimeoutList
    }
  } catch (err) {
    logger.error('error in timeout:', err)
    rethrow.rethrowAndCountFspiopError(err, { operation: 'timeoutHandler' })
  } finally {
    running = false
  }
}

/**
  * @function isRunning
  *
  * @description Function to determine if the timeoutJob is running
  *
  * @returns {boolean} Returns true if the timeoutJob is running
  */
const isRunning = async () => {
  return isRegistered
}

/**
  * @function stop
  *
  * @description Function to stop the timeoutJob if running
  *
  * @returns {boolean} Returns true when the job is stopped
  */
const stop = async () => {
  if (isRegistered) {
    await timeoutJob.stop()
    isRegistered = undefined
  }
}

/**
  * @function RegisterTimeoutHandlers
  *
  * @async
  * @description Registers the timeout handler by starting the timeoutJob cron
  * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
  */
const registerTimeoutHandler = async () => {
  try {
    if (isRegistered) {
      await stop()
    }

    timeoutJob = CronJob.from({
      cronTime: Config.HANDLERS_TIMEOUT_TIMEXP,
      onTick: timeout,
      start: false,
      timeZone: Config.HANDLERS_TIMEOUT_TIMEZONE
    })
    isRegistered = true

    await timeoutJob.start()
    return true
  } catch (err) {
    logger.error('error in registerTimeoutHandler:', err)
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerTimeoutHandler' })
  }
}

/**
  * @function RegisterAllHandlers
  *
  * @async
  * @description Registers all handlers in timeouts
  *
  * @returns {boolean} - Returns a boolean: true if successful, or throws and error if failed
  */
const registerAllHandlers = async () => {
  try {
    if (!Config.HANDLERS_TIMEOUT_DISABLED) {
      await registerTimeoutHandler()
    }
    return true
  } catch (err) {
    logger.error('error in registerAllHandlers:', err)
    rethrow.rethrowAndCountFspiopError(err, { operation: 'registerAllHandlers' })
  }
}

module.exports = {
  timeout,
  registerAllHandlers,
  registerTimeoutHandler,
  isRunning,
  stop
}
