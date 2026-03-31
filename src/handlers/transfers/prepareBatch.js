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
 --------------
 ******/

'use strict'

/**
 * @module src/handlers/transfers/prepareBatch
 *
 * Batch-processing variant of the transfer-prepare handler.
 *
 * Instead of processing one Kafka message at a time the handler accepts
 * an array of messages (configured via batchSize in the Kafka consumer
 * config) and replaces the per-message DB round-trips with a small set of
 * bulk SQL operations:
 *
 *   • 1 SELECT … WHERE transferId IN (…)  – duplicate-id check
 *   • 1 INSERT batch                       – persist new duplicate-check hashes
 *   • 1 SELECT … WHERE determiningTransferId IN (…) – FX watch-list check
 *   • 1 DB transaction with batch INSERTs  – persist all valid transfer rows
 *
 * For a batch of N messages this reduces the DB round-trip count from
 * roughly 10 N (serial) to roughly 10 + a constant overhead (~9x reduction
 * for N = 10, ~50x for N = 50).
 *
 * Forwarded messages and individual error / duplicate paths are handled
 * via the same helpers used by the single-message prepare handler.
 */

const EventSdk = require('@mojaloop/event-sdk')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const { Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const { logger } = require('../../shared/logger')
const Config = require('../../lib/config')
const TransferFacade = require('../../models/transfer/facade')
const TransferDuplicateCheckModel = require('../../models/transfer/transferDuplicateCheck')
const watchList = require('../../models/fxTransfer/watchList')

const { forwardPrepare, calculateProxyObligation, processDuplication, sendPositionPrepareMessage, savePreparedRequest } = require('./prepare')
const Validator = require('./validator')
const dto = require('./dto')
const createRemittanceEntity = require('./createRemittanceEntity')
const { shouldSkipParticipantCache } = require('../../lib/headerUtils')

const { Kafka } = Util
const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { createFSPIOPError, reformatFSPIOPError } = ErrorHandler.Factory
const { fspId } = Config.INSTRUMENTATION_METRICS_LABELS

const rethrow = require('../../shared/rethrow')
const consumerCommit = true
const fromSwitch = true

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the Kafka params object that Kafka.proceed() expects.
 */
const buildParams = ({ message, payload, span }) => ({
  message,
  kafkaTopic: message.topic,
  decodedPayload: payload,
  span,
  consumer: Consumer,
  producer: Producer
})

/**
 * Create an OpenTelemetry child span from a Kafka message.
 */
const createSpanFromMessage = (message, metric) => {
  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  return EventSdk.Tracer.createChildSpanFromContext(`cl_${metric}`, contextFromMessage)
}

/**
 * Inline the cyril watch-list logic for a batch of transfer messages.
 * Replaces N individual `getItemsInWatchListByDeterminingTransferId` queries
 * with a single batch query.
 *
 * @param {Array} contexts - array of message context objects (each with .ID, .payload, .proxyObligation)
 * @returns {Object.<string, DeterminingTransferCheckResult>} - keyed by transferId
 */
const batchCheckIfDeterminingTransferExists = async (contexts) => {
  const ids = contexts.map((ctx) => ctx.ID)
  const watchListMap = await watchList.getItemsInWatchListByDeterminingTransferIdBatch(ids)

  const results = {}
  for (const ctx of contexts) {
    const watchListRecords = watchListMap[ctx.ID] || []
    const determiningTransferExistsInWatchList = watchListRecords.length > 0
    const participantCurrencyValidationList = []

    if (determiningTransferExistsInWatchList) {
      // A prior FX transfer is waiting on this transfer as its "determining transfer".
      // The payeeFsp must have a position account in the transfer currency.
      if (!ctx.proxyObligation.isCounterPartyFspProxy) {
        participantCurrencyValidationList.push({
          participantName: ctx.payload.payeeFsp,
          currencyId: ctx.payload.amount.currency
        })
      }
    } else {
      // Normal transfer or payee-side currency conversion.
      if (!ctx.proxyObligation.isInitiatingFspProxy) {
        participantCurrencyValidationList.push({
          participantName: ctx.payload.payerFsp,
          currencyId: ctx.payload.amount.currency
        })
      }
      if (Config.PAYEE_PARTICIPANT_CURRENCY_VALIDATION_ENABLED) {
        if (!ctx.proxyObligation.isCounterPartyFspProxy) {
          participantCurrencyValidationList.push({
            participantName: ctx.payload.payeeFsp,
            currencyId: ctx.payload.amount.currency
          })
        }
      }
    }

    results[ctx.ID] = {
      determiningTransferExistsInWatchList,
      watchListRecords,
      participantCurrencyValidationList
    }
  }
  return results
}

// ---------------------------------------------------------------------------
// Main batch handler
// ---------------------------------------------------------------------------

/**
 * @function prepareBatch
 *
 * @async
 * @description Batch consumer callback for the transfer-prepare topic.
 *
 * Processes up to `batchSize` Kafka messages in a single invocation.
 * All batched transfers must be regular (non-FX) PREPARE messages;
 * forwarded messages are still handled individually via forwardPrepare.
 *
 * DB optimisations vs the single-message prepare handler:
 *  - 1 SELECT for duplicate checks  (was N SELECTs)
 *  - 1 INSERT for new hash records  (was N INSERTs)
 *  - 1 SELECT for fxWatchList check (was N SELECTs)
 *  - 1 DB transaction for all valid transfer inserts (was N transactions)
 *
 * @param {Error|null}  error    - Kafka error, if any
 * @param {Array|Object} messages - one or more Kafka messages
 *
 * @returns {boolean} true on success
 */
const prepareBatch = async (error, messages) => {
  const location = { module: 'PrepareBatchHandler', method: '', path: '' }

  // Use the first input to determine the metric label (isFx / isForwarded will
  // normally be homogeneous within a batch since the topic carries a single
  // action type, but we guard for mixed batches below).
  const firstInput = dto.prepareInputDto(error, messages)

  const histTimerEnd = Metrics.getHistogram(
    firstInput.metric,
    `Batch-consume ${firstInput.metric} messages from the kafka topic and process them`,
    ['success', 'fspId']
  ).startTimer()

  if (error) {
    histTimerEnd({ success: false, fspId })
    rethrow.rethrowAndCountFspiopError(error, { operation: 'transferPrepareBatch' })
  }

  const msgArray = Array.isArray(messages) ? messages : [messages]
  if (msgArray.length === 0) {
    histTimerEnd({ success: true, fspId })
    return true
  }

  logger.info(Util.breadcrumb(location, { method: 'prepareBatch' }), { batchSize: msgArray.length })

  // -------------------------------------------------------------------------
  // Step 1: Parse all messages into context objects.
  // -------------------------------------------------------------------------
  const contexts = msgArray.map((msg) => {
    const input = dto.prepareInputDto(null, msg)
    const span = createSpanFromMessage(msg, input.metric)
    span.setTags({ transactionId: input.ID, processedAsBatch: true })
    return { ...input, span }
  })

  // -------------------------------------------------------------------------
  // Step 2: Audit all spans (parallel – no DB).
  // -------------------------------------------------------------------------
  await Promise.all(contexts.map((ctx) => ctx.span.audit(ctx.message, EventSdk.AuditEventAction.start)))

  // -------------------------------------------------------------------------
  // Step 3: Split forwarded messages from fresh prepares.
  //          Forwarded messages are routed individually (same as non-batch).
  // -------------------------------------------------------------------------
  const forwardedContexts = contexts.filter((ctx) => ctx.isForwarded)
  const freshContexts = contexts.filter((ctx) => !ctx.isForwarded)

  if (forwardedContexts.length > 0) {
    await Promise.all(forwardedContexts.map(async (ctx) => {
      const params = buildParams(ctx)
      try {
        const isOk = await forwardPrepare({ isFx: ctx.isFx, params, ID: ctx.ID })
        logger.info('forwardPrepare (batch) is processed', { isOk, isFx: ctx.isFx, ID: ctx.ID })
      } catch (fwdErr) {
        const fspiopError = reformatFSPIOPError(fwdErr)
        const state = new EventSdk.EventStateMetadata(
          EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message
        )
        await ctx.span.error(fspiopError, state)
        await ctx.span.finish(fspiopError.message, state)
        return
      } finally {
        if (!ctx.span.isFinished) await ctx.span.finish()
      }
    }))
  }

  if (freshContexts.length === 0) {
    histTimerEnd({ success: true, fspId })
    return true
  }

  // -------------------------------------------------------------------------
  // Step 4: Calculate proxy obligations in parallel (uses Redis / in-memory
  //          cache – no MySQL round-trips for non-proxy scenarios).
  // -------------------------------------------------------------------------
  await Promise.all(freshContexts.map(async (ctx) => {
    const params = buildParams(ctx)
    ctx.params = params
    ctx.skipParticipantCache = shouldSkipParticipantCache(ctx.headers)
    ctx.proxyObligation = await calculateProxyObligation({
      payload: ctx.payload,
      isFx: ctx.isFx,
      params,
      functionality: ctx.functionality,
      action: ctx.action,
      skipParticipantCache: ctx.skipParticipantCache
    })
  }))

  // -------------------------------------------------------------------------
  // Step 5: Batch duplicate-check.
  //
  //   5a. Compute SHA-256 hash for every message payload (CPU – no DB).
  //   5b. Single SELECT … WHERE transferId IN (…) to find existing records.
  //   5c. Bucket into duplicates vs new.
  //   5d. Single batch INSERT for all new hash records.
  // -------------------------------------------------------------------------
  const Hash = Util.Hash
  const hashMap = {}
  for (const ctx of freshContexts) {
    hashMap[ctx.ID] = Hash.generateSha256(ctx.payload)
  }

  const ids = freshContexts.map((ctx) => ctx.ID)
  const existingDupMap = await TransferDuplicateCheckModel.getTransferDuplicateCheckBatch(ids)

  const duplicateContexts = freshContexts.filter((ctx) => Boolean(existingDupMap[ctx.ID]))
  const newContexts = freshContexts.filter((ctx) => !existingDupMap[ctx.ID])

  // Annotate duplicate contexts with duplication result.
  for (const ctx of duplicateContexts) {
    ctx.duplication = {
      hasDuplicateId: true,
      hasDuplicateHash: existingDupMap[ctx.ID].hash === hashMap[ctx.ID]
    }
  }

  // Persist new hash records in a single batch INSERT.
  if (newContexts.length > 0) {
    const hashRecords = newContexts.map((ctx) => ({ transferId: ctx.ID, hash: hashMap[ctx.ID] }))
    await TransferDuplicateCheckModel.saveTransferDuplicateCheckBatch(hashRecords)
  }

  // -------------------------------------------------------------------------
  // Step 6: Handle duplicates individually (same logic as non-batch path).
  // -------------------------------------------------------------------------
  await Promise.all(duplicateContexts.map(async (ctx) => {
    try {
      await processDuplication({
        duplication: ctx.duplication,
        isFx: ctx.isFx,
        ID: ctx.ID,
        functionality: ctx.functionality,
        action: ctx.action,
        actionLetter: ctx.actionLetter,
        params: ctx.params,
        location
      })
    } catch (dupErr) {
      const fspiopError = reformatFSPIOPError(dupErr)
      const state = new EventSdk.EventStateMetadata(
        EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message
      )
      logger.error(`${Util.breadcrumb(location)}::${dupErr.message}`, dupErr)
      await ctx.span.error(fspiopError, state)
      await ctx.span.finish(fspiopError.message, state)
      return
    } finally {
      if (!ctx.span.isFinished) await ctx.span.finish()
    }
  }))

  if (newContexts.length === 0) {
    histTimerEnd({ success: true, fspId })
    return true
  }

  // -------------------------------------------------------------------------
  // Step 7: Batch FX watch-list (cyril) check.
  //          Replaces N individual SELECT queries with one.
  // -------------------------------------------------------------------------
  const cyrilResults = await batchCheckIfDeterminingTransferExists(newContexts)
  for (const ctx of newContexts) {
    ctx.determiningTransferCheckResult = cyrilResults[ctx.ID]
  }

  // -------------------------------------------------------------------------
  // Step 8: Validate each message.
  //
  // IMPORTANT: Validator.validatePrepare uses a module-level `reasons` array
  // that is mutated on every call.  Concurrent calls would corrupt each
  // other's results, so we call them sequentially and snapshot the array.
  // -------------------------------------------------------------------------
  for (const ctx of newContexts) {
    const result = await Validator.validatePrepare(
      ctx.payload,
      ctx.headers,
      ctx.isFx,
      ctx.determiningTransferCheckResult,
      ctx.proxyObligation
    )
    ctx.validationPassed = result.validationPassed
    ctx.reasons = [...result.reasons] // snapshot before the next call clears it
  }

  // -------------------------------------------------------------------------
  // Step 9: Persist transfer records.
  //
  //   - Valid transfers  → single DB transaction with batch INSERTs.
  //   - Invalid transfers → individual inserts (reuses savePreparedRequest).
  // -------------------------------------------------------------------------
  const validContexts = newContexts.filter((ctx) => ctx.validationPassed)
  const invalidContexts = newContexts.filter((ctx) => !ctx.validationPassed)

  // Persist all valid transfers in one transaction.
  if (validContexts.length > 0) {
    try {
      await TransferFacade.saveTransferPreparedBatch(
        validContexts.map((ctx) => ({
          payload: ctx.payload,
          stateReason: null,
          determiningTransferCheckResult: ctx.determiningTransferCheckResult,
          proxyObligation: ctx.proxyObligation
        }))
      )
    } catch (saveErr) {
      // If the batch save fails, fall back to individual saves so we don't
      // silently drop messages.
      logger.warn('saveTransferPreparedBatch failed, falling back to individual saves:', saveErr)
      for (const ctx of validContexts) {
        await savePreparedRequest({
          validationPassed: true,
          reasons: [],
          payload: ctx.payload,
          isFx: ctx.isFx,
          functionality: ctx.functionality,
          params: ctx.params,
          location,
          determiningTransferCheckResult: ctx.determiningTransferCheckResult,
          proxyObligation: ctx.proxyObligation
        })
      }
    }
  }

  // Persist invalid transfers individually (audit trail – rare path).
  await Promise.all(invalidContexts.map((ctx) =>
    savePreparedRequest({
      validationPassed: false,
      reasons: ctx.reasons,
      payload: ctx.payload,
      isFx: ctx.isFx,
      functionality: ctx.functionality,
      params: ctx.params,
      location,
      determiningTransferCheckResult: ctx.determiningTransferCheckResult,
      proxyObligation: ctx.proxyObligation
    })
  ))

  // -------------------------------------------------------------------------
  // Step 10: Send validation-error notifications for invalid transfers.
  // -------------------------------------------------------------------------
  await Promise.all(invalidContexts.map(async (ctx) => {
    try {
      logger.warn(Util.breadcrumb(location, { path: 'validationFailed' }), { ID: ctx.ID })
      const fspiopError = createFSPIOPError(FSPIOPErrorCodes.VALIDATION_ERROR, ctx.reasons.toString())
      await createRemittanceEntity(ctx.isFx)
        .logTransferError(ctx.ID, FSPIOPErrorCodes.VALIDATION_ERROR.code, ctx.reasons.toString())
      await Kafka.proceed(Config.KAFKA_CONFIG, ctx.params, {
        consumerCommit,
        fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
        eventDetail: { functionality: ctx.functionality, action: ctx.action },
        fromSwitch,
        hubName: Config.HUB_NAME
      })
      rethrow.rethrowAndCountFspiopError(fspiopError, { operation: 'transferPrepareBatch' })
    } catch (errNotifErr) {
      const fspiopError = reformatFSPIOPError(errNotifErr)
      const state = new EventSdk.EventStateMetadata(
        EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message
      )
      logger.error(`${Util.breadcrumb(location)}::${errNotifErr.message}`, errNotifErr)
      await ctx.span.error(fspiopError, state)
      await ctx.span.finish(fspiopError.message, state)
    } finally {
      if (!ctx.span.isFinished) await ctx.span.finish()
    }
  }))

  // -------------------------------------------------------------------------
  // Step 11: Route all valid transfers to the position topic in parallel.
  // -------------------------------------------------------------------------
  await Promise.all(validContexts.map(async (ctx) => {
    try {
      await sendPositionPrepareMessage({
        isFx: ctx.isFx,
        action: ctx.action,
        params: ctx.params,
        determiningTransferCheckResult: ctx.determiningTransferCheckResult,
        proxyObligation: ctx.proxyObligation
      })
    } catch (routeErr) {
      const fspiopError = reformatFSPIOPError(routeErr)
      const state = new EventSdk.EventStateMetadata(
        EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message
      )
      logger.error(`${Util.breadcrumb(location)}::${routeErr.message}`, routeErr)
      await ctx.span.error(fspiopError, state)
      await ctx.span.finish(fspiopError.message, state)
      return
    } finally {
      if (!ctx.span.isFinished) await ctx.span.finish()
    }
  }))

  histTimerEnd({ success: true, fspId })
  return true
}

module.exports = {
  prepareBatch,
  batchCheckIfDeterminingTransferExists
}
