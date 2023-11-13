const EventSdk = require('@mojaloop/event-sdk')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Metrics = require('@mojaloop/central-services-metrics')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const { logger } = require('../../shared/logger')
const Config = require('../../lib/config')
const TransferService = require('../../domain/transfer')
const TransferObjectTransform = require('../../domain/transfer/transform')
const Participant = require('../../domain/participant')

const createRemittanceEntity = require('./createRemittanceEntity')
const Validator = require('./validator')
const dto = require('./dto')

const { Kafka, Comparators } = Util
const { TransferState } = Enum.Transfers
const { Action, Type } = Enum.Events.Event
const { FSPIOPErrorCodes } = ErrorHandler.Enums
const { createFSPIOPError, reformatFSPIOPError } = ErrorHandler.Factory
const { fspId } = Config.INSTRUMENTATION_METRICS_LABELS

const consumerCommit = true
const fromSwitch = true

const checkDuplication = async ({ payload, isFx, ID, location }) => {
  const funcName = 'prepare_duplicateCheckComparator'
  const histTimerDuplicateCheckEnd = Metrics.getHistogram(
    'handler_transfers',
      `${funcName} - Metrics for transfer handler`,
      ['success', 'funcName']
  ).startTimer()

  const remittance = createRemittanceEntity(isFx)
  const { hasDuplicateId, hasDuplicateHash } = await Comparators.duplicateCheckComparator(
    ID,
    payload,
    remittance.getDuplicate,
    remittance.saveDuplicateHash
  )

  logger.info(Util.breadcrumb(location, { path: funcName }), { hasDuplicateId, hasDuplicateHash, isFx, ID })
  histTimerDuplicateCheckEnd({ success: true, funcName })

  return { hasDuplicateId, hasDuplicateHash }
}

const processDuplication = async ({
  duplication, isFx, ID, functionality, action, actionLetter, params, location
}) => {
  if (!duplication.hasDuplicateId) return

  let error
  if (!duplication.hasDuplicateHash) {
    logger.error(Util.breadcrumb(location, `callbackErrorModified1--${actionLetter}5`))
    error = createFSPIOPError(FSPIOPErrorCodes.MODIFIED_REQUEST)
  } else if (action === Action.BULK_PREPARE) {
    logger.info(Util.breadcrumb(location, `validationError1--${actionLetter}2`))
    error = createFSPIOPError('Individual transfer prepare duplicate')
  }

  if (error) {
    await Kafka.proceed(Config.KAFKA_CONFIG, params, {
      consumerCommit,
      fspiopError: error.toApiErrorObject(Config.ERROR_HANDLING),
      eventDetail: { functionality, action },
      fromSwitch
    })
    throw error
  }

  logger.info(Util.breadcrumb(location, 'handleResend'))
  const remittance = createRemittanceEntity(isFx)
  const transfer = await remittance.getByIdLight(ID)

  const isFinalized = [TransferState.COMMITTED, TransferState.ABORTED].includes(transfer?.transferStateEnumeration)
  const isPrepare = [Action.PREPARE, Action.FX_PREPARE].includes(action)

  if (isFinalized && isPrepare) {
    logger.info(Util.breadcrumb(location, `finalized callback--${actionLetter}1`))
    params.message.value.content.payload = TransferObjectTransform.toFulfil(transfer, isFx)
    params.message.value.content.uriParams = { id: ID }
    const eventDetail = { functionality, action: Action.PREPARE_DUPLICATE }
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit, eventDetail, fromSwitch })
  } else {
    logger.info(Util.breadcrumb(location, `ignore--${actionLetter}3`))
    await Kafka.proceed(Config.KAFKA_CONFIG, params, { consumerCommit })
  }

  return true
}

const savePreparedRequest = async ({ validationPassed, reasons, payload, functionality, params, location }) => {
  const logMessage = Util.breadcrumb(location, 'savePreparedRequest')
  try {
    logger.info(logMessage, { validationPassed, reasons })
    const reason = validationPassed ? null : reasons.toString()
    // !!! todo: adjust for FX
    await TransferService.prepare(payload, reason, validationPassed)
  } catch (err) {
    logger.error(`${logMessage} error - ${err.message}`)
    const fspiopError = reformatFSPIOPError(err, FSPIOPErrorCodes.INTERNAL_SERVER_ERROR)
    await Kafka.proceed(Config.KAFKA_CONFIG, params, {
      consumerCommit,
      fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
      eventDetail: { functionality, action: Action.PREPARE },
      fromSwitch
    })
    throw fspiopError
  }
}

const sendPositionPrepareMessage = async ({ isFx, payload, action, params }) => {
  const eventDetail = {
    functionality: Type.POSITION,
    action
  }
  const name = isFx ? payload.initiatingFsp : payload.payerFsp
  const currency = isFx ? payload.sourceAmount.currency : payload.amount.currency
  // todo: adjust for FX
  // Key position prepare message with payer account id
  const payerAccount = await Participant.getAccountByNameAndCurrency(name, currency, Enum.Accounts.LedgerAccountType.POSITION)

  await Kafka.proceed(Config.KAFKA_CONFIG, params, {
    consumerCommit,
    eventDetail,
    messageKey: payerAccount.participantCurrencyId.toString(),
    topicNameOverride: Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP?.POSITION?.PREPARE
  })

  return true
}

/**
 * @function TransferPrepareHandler
 *
 * @async
 * @description This is the consumer callback function that gets registered to a topic. This then gets a list of messages,
 * we will only ever use the first message in non batch processing. We then break down the message into its payload and
 * begin validating the payload. Once the payload is validated successfully it will be written to the database to
 * the relevant tables. If the validation fails it is still written to the database for auditing purposes but with an
 * INVALID status. For any duplicate requests we will send appropriate callback based on the transfer state and the hash validation
 *
 * Validator.validatePrepare called to validate the payload of the message
 * TransferService.getById called to get the details of the existing transfer
 * TransferObjectTransform.toTransfer called to transform the transfer object
 * TransferService.prepare called and creates new entries in transfer tables for successful prepare transfer
 * TransferService.logTransferError called to log the invalid request
 *
 * @param {error} error - error thrown if something fails within Kafka
 * @param {array} messages - a list of messages to consume for the relevant topic
 *
 * @returns {object} - Returns a boolean: true if successful, or throws and error if failed
 */
const prepare = async (error, messages) => {
  const location = { module: 'PrepareHandler', method: '', path: '' }
  const input = dto.prepareInputDto(error, messages)

  const histTimerEnd = Metrics.getHistogram(
    input.metric,
    `Consume a ${input.metric} message from the kafka topic and process it accordingly`,
    ['success', 'fspId']
  ).startTimer()
  if (error) {
    histTimerEnd({ success: false, fspId })
    throw reformatFSPIOPError(error)
  }

  const {
    message, payload, isFx, ID, headers, action, actionLetter, functionality
  } = input

  const contextFromMessage = EventSdk.Tracer.extractContextFromMessage(message.value)
  const span = EventSdk.Tracer.createChildSpanFromContext(`cl_${input.metric}`, contextFromMessage)

  try {
    span.setTags({ transactionId: ID })
    await span.audit(message, EventSdk.AuditEventAction.start)
    logger.info(Util.breadcrumb(location, { method: 'prepare' }))

    const params = {
      message,
      kafkaTopic: message.topic,
      decodedPayload: payload,
      span,
      consumer: Consumer,
      producer: Producer
    }

    const duplication = await checkDuplication({ payload, isFx, ID, location })
    if (duplication.hasDuplicateId) {
      const success = await processDuplication({
        duplication, isFx, ID, functionality, action, actionLetter, params, location
      })
      histTimerEnd({ success, fspId })
      return success
    }

    const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
    await savePreparedRequest({ validationPassed, reasons, payload, functionality, params, location })

    if (!validationPassed) {
      logger.error(Util.breadcrumb(location, { path: 'validationFailed' }))
      const fspiopError = createFSPIOPError(FSPIOPErrorCodes.VALIDATION_ERROR, reasons.toString())
      const remittance = createRemittanceEntity(isFx)
      await remittance.logTransferError(ID, FSPIOPErrorCodes.VALIDATION_ERROR.code, reasons.toString())
      /**
       * TODO: BULK-Handle at BulkProcessingHandler (not in scope of #967)
       * HOWTO: For regular transfers this branch may be triggered by sending
       * a tansfer in a currency not supported by either dfsp. Not sure if it
       * will be triggered for bulk, because of the BulkPrepareHandler.
       */
      await Kafka.proceed(Config.KAFKA_CONFIG, params, {
        consumerCommit,
        fspiopError: fspiopError.toApiErrorObject(Config.ERROR_HANDLING),
        eventDetail: { functionality, action },
        fromSwitch
      })
      throw fspiopError
    }

    logger.info(Util.breadcrumb(location, `positionTopic1--${actionLetter}7`))
    const success = await sendPositionPrepareMessage({ isFx, payload, action, params })
    histTimerEnd({ success, fspId })
    return success
  } catch (err) {
    histTimerEnd({ success: false, fspId })
    const fspiopError = reformatFSPIOPError(err)
    logger.error(`${Util.breadcrumb(location)}::${err.message}--P0`)
    const state = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, fspiopError.apiErrorCode.code, fspiopError.apiErrorCode.message)
    await span.error(fspiopError, state)
    await span.finish(fspiopError.message, state)
    return true
  } finally {
    if (!span.isFinished) {
      await span.finish()
    }
  }
}

module.exports = prepare
