/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const Test = require('tape')
const { randomUUID } = require('crypto')
const { Db } = require('@mojaloop/database-lib')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const { Producer } = require('@mojaloop/central-services-stream').Kafka
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const UtilProducer = require('@mojaloop/central-services-stream').Util.Producer

const Config = require('#src/lib/config')
const Cache = require('#src/lib/cache')
const ProxyCache = require('#src/lib/proxyCache')
const fspiopErrorFactory = require('#src/shared/fspiopErrorFactory')
const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const SettlementModelCached = require('#src/models/settlement/settlementModelCached')
const fxTransferModel = require('#src/models/fxTransfer/index')
const prepare = require('#src/handlers/transfers/prepare')
const cyril = require('#src/domain/fx/cyril')
const { logger } = require('#src/shared/logger/index')
const { TABLE_NAMES } = require('#src/shared/constants')
const FxTransferModels = require('#src/models/fxTransfer/index')

const { checkErrorPayload, wrapWithRetries } = require('#test/util/helpers')
const createTestConsumer = require('#test/integration/helpers/createTestConsumer')
const ParticipantHelper = require('#test/integration/helpers/participant')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const fixtures = require('#test/fixtures')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')

const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action
const kafkaUtil = Util.Kafka
const { Action, Type } = Enum.Events.Event
const { TOPICS } = fixtures

const retryDelay = process?.env?.TEST_INT_RETRY_DELAY || 2
const retryCount = process?.env?.TEST_INT_RETRY_COUNT || 40
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}
const TOPIC_POSITION_BATCH = 'topic-transfer-position-batch'

const testFxData = {
  sourceAmount: {
    currency: 'USD',
    amount: 433.88
  },
  targetAmount: {
    currency: 'XXX',
    amount: 200.00
  },
  payer: {
    name: 'payerFsp',
    limit: 5000
  },
  payee: {
    name: 'payeeFsp',
    limit: 5000
  },
  fxp: {
    name: 'fxp',
    limit: 3000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const prepareFxTestData = async (dataObj) => {
  try {
    const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.sourceAmount.currency)
    const fxp = await ParticipantHelper.prepareData(dataObj.fxp.name, dataObj.sourceAmount.currency, dataObj.targetAmount.currency)
    const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.targetAmount.currency)

    const payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
      currency: dataObj.sourceAmount.currency,
      limit: { value: dataObj.payer.limit }
    })
    const fxpLimitAndInitialPositionSourceCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.sourceAmount.currency,
      limit: { value: dataObj.fxp.limit }
    })
    const fxpLimitAndInitialPositionTargetCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.targetAmount.currency,
      limit: { value: dataObj.fxp.limit }
    })
    const payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
      currency: dataObj.targetAmount.currency,
      limit: { value: dataObj.payee.limit }
    })
    await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
      currency: dataObj.sourceAmount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyId2, {
      currency: dataObj.sourceAmount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyIdSecondary2, {
      currency: dataObj.targetAmount.currency,
      amount: 10000
    })

    for (const name of [payer.participant.name, fxp.participant.name]) {
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${dataObj.endpoint.base}/transfers`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${dataObj.endpoint.base}/transfers/{{transferId}}`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${dataObj.endpoint.base}/transfers/{{transferId}}/error`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${dataObj.endpoint.base}/bulkTransfers`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${dataObj.endpoint.base}/bulkTransfers/{{id}}`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${dataObj.endpoint.base}/bulkTransfers/{{id}}/error`)
      await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_QUOTES', `${dataObj.endpoint.base}`)
      await ParticipantEndpointHelper.prepareData(name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES, `${dataObj.endpoint.base}`)
      await ParticipantEndpointHelper.prepareData(name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST, `${dataObj.endpoint.base}/fxTransfers`)
      await ParticipantEndpointHelper.prepareData(name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT, `${dataObj.endpoint.base}/fxTransfers/{{commitRequestId}}`)
      await ParticipantEndpointHelper.prepareData(name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR, `${dataObj.endpoint.base}/fxTransfers/{{commitRequestId}}/error`)
    }

    const transferId = randomUUID()

    const fxTransferPayload = {
      commitRequestId: randomUUID(),
      determiningTransferId: transferId,
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expiration: dataObj.expiration,
      initiatingFsp: payer.participant.name,
      counterPartyFsp: fxp.participant.name,
      sourceAmount: {
        currency: dataObj.sourceAmount.currency,
        amount: dataObj.sourceAmount.amount
      },
      targetAmount: {
        currency: dataObj.targetAmount.currency,
        amount: dataObj.targetAmount.amount
      }
    }

    const fxPrepareHeaders = {
      'fspiop-source': payer.participant.name,
      'fspiop-destination': fxp.participant.name,
      'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0'
    }

    const transferPayload = {
      transferId,
      payerFsp: payer.participant.name,
      payeeFsp: payee.participant.name,
      amount: {
        currency: dataObj.targetAmount.currency,
        amount: dataObj.targetAmount.amount
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
      expiration: dataObj.expiration,
      extensionList: {
        extension: [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
      }
    }

    const sourceTransferPayload = {
      transferId,
      payerFsp: payer.participant.name,
      payeeFsp: fxp.participant.name,
      amount: {
        currency: dataObj.sourceAmount.currency,
        amount: dataObj.sourceAmount.amount
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
      expiration: dataObj.expiration
    }

    const fulfilPayload = {
      fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
      completedTimestamp: dataObj.now,
      transferState: 'COMMITTED'
    }

    const rejectPayload = Object.assign({}, fulfilPayload, { transferState: TransferInternalState.ABORTED_REJECTED })

    const prepareHeaders = {
      'fspiop-source': payer.participant.name,
      'fspiop-destination': payee.participant.name,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    }

    const fulfilHeaders = {
      'fspiop-source': payee.participant.name,
      'fspiop-destination': payer.participant.name,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    }

    const fxFulfilHeaders = {
      'fspiop-source': fxp.participant.name,
      'fspiop-destination': payer.participant.name,
      'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0'
    }

    const errorPayload = ErrorHandler.Factory.createFSPIOPError(
      ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_FSP_REJECTED_TXN
    ).toApiErrorObject()
    errorPayload.errorInformation.extensionList = {
      extension: [{
        key: 'errorDetail',
        value: 'This is an abort extension'
      }]
    }

    const messageProtocolPayerInitiatedConversionFxPrepare = {
      id: randomUUID(),
      from: fxTransferPayload.initiatingFsp,
      to: fxTransferPayload.counterPartyFsp,
      type: 'application/json',
      content: {
        headers: fxPrepareHeaders,
        payload: fxTransferPayload
      },
      metadata: {
        event: {
          id: randomUUID(),
          type: TransferEventType.TRANSFER,
          action: TransferEventAction.FX_PREPARE,
          createdAt: dataObj.now,
          state: {
            status: 'success',
            code: 0
          }
        }
      }
    }

    const messageProtocolPrepare = {
      id: randomUUID(),
      from: transferPayload.payerFsp,
      to: transferPayload.payeeFsp,
      type: 'application/json',
      content: {
        headers: prepareHeaders,
        payload: transferPayload
      },
      metadata: {
        event: {
          id: randomUUID(),
          type: TransferEventAction.PREPARE,
          action: TransferEventType.PREPARE,
          createdAt: dataObj.now,
          state: {
            status: 'success',
            code: 0
          }
        }
      }
    }

    const messageProtocolSourcePrepare = Util.clone(messageProtocolPrepare)
    messageProtocolSourcePrepare.to = sourceTransferPayload.payeeFsp
    messageProtocolSourcePrepare.content.payload = sourceTransferPayload
    messageProtocolSourcePrepare.content.headers = {
      ...prepareHeaders,
      'fspiop-destination': fxp.participant.name
    }

    const messageProtocolFulfil = Util.clone(messageProtocolPrepare)
    messageProtocolFulfil.id = randomUUID()
    messageProtocolFulfil.from = transferPayload.payeeFsp
    messageProtocolFulfil.to = transferPayload.payerFsp
    messageProtocolFulfil.content.headers = fulfilHeaders
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolFulfil.content.payload = fulfilPayload
    messageProtocolFulfil.metadata.event.id = randomUUID()
    messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
    messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

    const messageProtocolPayerInitiatedConversionFxFulfil = Util.clone(messageProtocolPayerInitiatedConversionFxPrepare)
    messageProtocolPayerInitiatedConversionFxFulfil.id = randomUUID()
    messageProtocolPayerInitiatedConversionFxFulfil.from = transferPayload.counterPartyFsp
    messageProtocolPayerInitiatedConversionFxFulfil.to = transferPayload.initiatingFsp
    messageProtocolPayerInitiatedConversionFxFulfil.content.headers = fxFulfilHeaders
    messageProtocolPayerInitiatedConversionFxFulfil.content.uriParams = { id: fxTransferPayload.commitRequestId }
    messageProtocolPayerInitiatedConversionFxFulfil.content.payload = fulfilPayload
    messageProtocolPayerInitiatedConversionFxFulfil.metadata.event.id = randomUUID()
    messageProtocolPayerInitiatedConversionFxFulfil.metadata.event.type = TransferEventType.FULFIL
    messageProtocolPayerInitiatedConversionFxFulfil.metadata.event.action = TransferEventAction.FX_RESERVE

    const messageProtocolReject = Util.clone(messageProtocolFulfil)
    messageProtocolReject.id = randomUUID()
    messageProtocolReject.content.uriParams = { id: transferPayload.transferId }
    messageProtocolReject.content.payload = rejectPayload
    messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

    const messageProtocolError = Util.clone(messageProtocolFulfil)
    messageProtocolError.id = randomUUID()
    messageProtocolError.content.uriParams = { id: transferPayload.transferId }
    messageProtocolError.content.payload = errorPayload
    messageProtocolError.metadata.event.action = TransferEventAction.ABORT

    const messageProtocolFxAbort = Util.clone(messageProtocolPayerInitiatedConversionFxFulfil)
    messageProtocolFxAbort.id = randomUUID()
    messageProtocolFxAbort.content.uriParams = { id: fxTransferPayload.commitRequestId }
    messageProtocolFxAbort.content.payload = errorPayload
    messageProtocolFxAbort.metadata.event.action = TransferEventAction.FX_ABORT

    const topicConfFxTransferPrepare = Utility.createGeneralTopicConf(
      Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      TransferEventType.TRANSFER,
      TransferEventAction.PREPARE
    )

    const topicConfTransferPrepare = Utility.createGeneralTopicConf(
      Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      TransferEventType.TRANSFER,
      TransferEventType.PREPARE
    )

    const topicConfTransferFulfil = Utility.createGeneralTopicConf(
      Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      TransferEventType.TRANSFER,
      TransferEventType.FULFIL
    )

    return {
      fxTransferPayload,
      transferPayload,
      fulfilPayload,
      rejectPayload,
      errorPayload,
      messageProtocolPayerInitiatedConversionFxPrepare,
      messageProtocolPayerInitiatedConversionFxFulfil,
      messageProtocolFxAbort,
      messageProtocolPrepare,
      messageProtocolFulfil,
      messageProtocolReject,
      messageProtocolError,
      messageProtocolSourcePrepare,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      topicConfFxTransferPrepare,
      payer,
      payerLimitAndInitialPosition,
      fxp,
      fxpLimitAndInitialPositionSourceCurrency,
      fxpLimitAndInitialPositionTargetCurrency,
      payee,
      payeeLimitAndInitialPosition
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const storeFxTransferPreparePayload = async (fxTransfer, transferStateId = '', addToWatchList = true) => {
  const { commitRequestId } = fxTransfer
  const isFx = true
  const log = logger.child({ commitRequestId })
  const proxyObligation = {
    isInitiatingFspProxy: false,
    isCounterPartyFspProxy: false,
    initiatingFspProxyOrParticipantId: null,
    counterPartyFspProxyOrParticipantId: null
  }
  const dupResult = await prepare.checkDuplication({
    payload: fxTransfer,
    isFx,
    ID: commitRequestId,
    location: {}
  })
  if (dupResult.hasDuplicateId) throw new Error('fxTransfer prepare Duplication Error')

  await prepare.savePreparedRequest({
    payload: fxTransfer,
    isFx,
    functionality: Type.NOTIFICATION,
    params: {},
    validationPassed: true,
    reasons: [],
    location: {},
    proxyObligation
  })

  if (transferStateId) {
    const knex = Db.getKnex()
    await knex(TABLE_NAMES.fxTransferStateChange)
      .update({
        transferStateId,
        reason: 'fxFulfil int-test'
      })
      .where({ commitRequestId })
    // https://github.com/mojaloop/central-ledger/blob/ad4dd53d6914628813aa30a1dcd3af2a55f12b0d/src/domain/position/fx-prepare.js#L187
    log.info('fxTransfer state is updated', { transferStateId })
  }

  if (addToWatchList) {
    const determiningTransferCheckResult = await cyril.checkIfDeterminingTransferExistsForFxTransferMessage(
      fxTransfer,
      proxyObligation
    )
    await cyril.getParticipantAndCurrencyForFxTransferMessage(fxTransfer, determiningTransferCheckResult)
    log.info('fxTransfer is added to watchList', { fxTransfer })
  }
}

Test('FxFulfil flow Integration Tests -->', async fxFulfilTest => {
  await Db.connect(Config.DATABASE)
  await Promise.all([
    ParticipantCached.initialize(),
    ParticipantCurrencyCached.initialize(),
    ParticipantLimitCached.initialize(),
    SettlementModelCached.initialize(),
    Cache.initCache(),
    SettlementHelper.prepareData(),
    HubAccountsHelper.prepareData()
  ])
  const wrapWithRetriesConf = {
    remainingRetries: retryOpts?.retries || 10, // default 10
    timeout: retryOpts?.maxTimeout || 2 // default 2
  }

  const dfspNamePrefix = 'dfsp_'
  const fxpNamePrefix = 'fxp_'
  const sourceAmount = fixtures.amountDto({ currency: 'USD', amount: 433.88 })
  const targetAmount = fixtures.amountDto({ currency: 'XXX', amount: 200.22 })

  const [payer, fxp] = await Promise.all([
    ParticipantHelper.prepareData(dfspNamePrefix, sourceAmount.currency),
    ParticipantHelper.prepareData(fxpNamePrefix, sourceAmount.currency, targetAmount.currency)
  ])

  const DFSP_1 = payer.participant.name
  const FXP = fxp.participant.name

  const createFxFulfilKafkaMessage = ({ commitRequestId, fulfilment, action = Action.FX_RESERVE } = {}) => {
    const content = fixtures.fxFulfilContentDto({
      commitRequestId,
      payload: fixtures.fxFulfilPayloadDto({ fulfilment }),
      from: FXP,
      to: DFSP_1
    })
    const fxFulfilMessage = fixtures.fxFulfilKafkaMessageDto({
      content,
      from: FXP,
      to: DFSP_1,
      metadata: fixtures.fulfilMetadataDto({ action })
    })
    return fxFulfilMessage.value
  }

  const topicFxFulfilConfig = kafkaUtil.createGeneralTopicConf(
    Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
    Type.TRANSFER,
    Action.FULFIL
  )
  const fxFulfilProducerConfig = kafkaUtil.getKafkaConfig(
    Config.KAFKA_CONFIG,
    Enum.Kafka.Config.PRODUCER,
    Type.TRANSFER.toUpperCase(),
    Action.FULFIL.toUpperCase()
  )
  const producer = new Producer(fxFulfilProducerConfig)
  await producer.connect()
  const produceMessageToFxFulfilTopic = async (message) => producer.sendMessage(message, topicFxFulfilConfig)

  const testConsumer = createTestConsumer([
    { type: Type.NOTIFICATION, action: Action.EVENT },
    { type: Type.TRANSFER, action: Action.POSITION },
    { type: Type.TRANSFER, action: Action.FULFIL }
  ])
  const batchTopicConfig = {
    topicName: TOPICS.transferPositionBatch,
    config: Util.Kafka.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.CONSUMER,
      Enum.Events.Event.Type.TRANSFER.toUpperCase(),
      Enum.Events.Event.Action.POSITION.toUpperCase()
    )
  }
  testConsumer.handlers.push(batchTopicConfig)
  await testConsumer.startListening()
  await new Promise(resolve => setTimeout(resolve, 5_000))
  testConsumer.clearEvents()
  fxFulfilTest.pass('setup is done')

  fxFulfilTest.test('should publish a message to send error callback if fxTransfer does not exist', async (t) => {
    const noFxTransferMessage = createFxFulfilKafkaMessage()
    const isTriggered = await produceMessageToFxFulfilTopic(noFxTransferMessage)
    t.ok(isTriggered, 'test is triggered')

    try {
      const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: TOPICS.notificationEvent,
        action: Action.FX_RESERVE,
        valueToFilter: FXP
      }))
      t.ok(messages[0], 'Notification event message is sent')
      t.equal(messages[0].value.id, noFxTransferMessage.id)
      checkErrorPayload(t)(messages[0].value.content.payload, fspiopErrorFactory.fxTransferNotFound())
    } catch (err) {
      t.notOk('Error should not be thrown')
      console.error(err)
    }
    t.end()
  })

  fxFulfilTest.test('should process fxFulfil message (happy path)', async (t) => {
    const fxTransfer = fixtures.fxTransferDto({
      initiatingFsp: DFSP_1,
      counterPartyFsp: FXP,
      sourceAmount,
      targetAmount
    })
    const { commitRequestId } = fxTransfer

    await storeFxTransferPreparePayload(fxTransfer, Enum.Transfers.TransferState.RESERVED)
    t.pass(`fxTransfer prepare is saved in DB: ${commitRequestId}`)

    const fxFulfilMessage = createFxFulfilKafkaMessage({ commitRequestId })
    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')
    try {
      const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: TOPICS.transferPositionBatch,
        action: Action.FX_RESERVE
      }))
      t.ok(messages[0], `Message is sent to ${TOPICS.transferPositionBatch}`)
      const { from, to, content } = messages[0].value
      t.equal(from, FXP)
      t.equal(to, DFSP_1)
      t.equal(content.payload.fulfilment, fxFulfilMessage.content.payload.fulfilment, 'fulfilment is correct')
    } catch (err) {
      t.notOk('Error should not be thrown')
      console.error(err)
    }
    t.end()
  })

  fxFulfilTest.test('should check duplicates, and detect modified request (hash is not the same)', async (t) => {
    const fxTransfer = fixtures.fxTransferDto({
      initiatingFsp: DFSP_1,
      counterPartyFsp: FXP,
      sourceAmount,
      targetAmount
    })
    const { commitRequestId } = fxTransfer

    await storeFxTransferPreparePayload(fxTransfer, '', false)
    await fxTransferModel.duplicateCheck.saveFxTransferFulfilmentDuplicateCheck(commitRequestId, 'wrongHash')
    t.pass(`fxTransfer prepare and duplicateCheck are saved in DB: ${commitRequestId}`)

    const fxFulfilMessage = createFxFulfilKafkaMessage({ commitRequestId })
    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')

    try {
      const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: TOPICS.transferPosition,
        action: Action.FX_FULFIL_DUPLICATE
      }))
      t.ok(messages[0], `Message is sent to ${TOPICS.transferPosition}`)
      const { from, to, content, metadata } = messages[0].value
      t.equal(from, fixtures.SWITCH_ID)
      t.equal(to, FXP)
      t.equal(metadata.event.type, Type.NOTIFICATION)
      checkErrorPayload(t)(content.payload, fspiopErrorFactory.noFxDuplicateHash())
    } catch (err) {
      t.notOk('Error should not be thrown')
      console.error(err)
    }
    t.end()
  })

  fxFulfilTest.test('should detect invalid fulfilment', async (t) => {
    const td = await prepareFxTestData(testFxData)

    const prepareConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventAction.PREPARE.toUpperCase()
    )
    prepareConfig.logger = logger
    await UtilProducer.produceMessage(
      td.messageProtocolPayerInitiatedConversionFxPrepare,
      td.topicConfFxTransferPrepare,
      prepareConfig
    )

    try {
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: TOPIC_POSITION_BATCH,
        action: Enum.Events.Event.Action.FX_PREPARE,
        keyFilter: td.payer.participantCurrencyId.toString()
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      t.ok(positionPrepare[0], 'Position fx-prepare message with key found')
    } catch (err) {
      t.notOk('Error should not be thrown')
      console.error(err)
    }

    try {
      await wrapWithRetries(async () => {
        const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}
        if (fxTransfer?.transferState !== TransferInternalState.RESERVED) {
          console.log(`retrying in ${retryDelay / 1000}s..`)
          return null
        }
        return fxTransfer
      }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
    } catch (err) {
      logger.error(err)
      t.fail(err.message)
    }

    const config = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.FULFIL.toUpperCase())
    config.logger = logger

    td.messageProtocolPayerInitiatedConversionFxFulfil.content.payload.fulfilment = 'invalidFulfilment'
    await UtilProducer.produceMessage(td.messageProtocolPayerInitiatedConversionFxFulfil, td.topicConfTransferFulfil, config)

    try {
      const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: TOPICS.transferPositionBatch,
        action: Action.FX_ABORT_VALIDATION
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      t.ok(messages[0], `Message is sent to ${TOPICS.transferPositionBatch}`)
      const { from, to, content } = messages[0].value
      t.equal(from, 'Hub')
      t.equal(to, td.payer.participant.name)
      checkErrorPayload(t)(content.payload, fspiopErrorFactory.fxInvalidFulfilment())
    } catch (err) {
      t.notOk('Error should not be thrown')
      console.error(err)
    }

    t.end()
  })

  fxFulfilTest.test('teardown', async (t) => {
    await Promise.all([
      Db.disconnect(),
      Cache.destroyCache(),
      producer.disconnect(),
      testConsumer.destroy(),
      UtilProducer.disconnect()
    ])
    await ProxyCache.disconnect()
    await new Promise(resolve => setTimeout(resolve, 5_000))
    t.pass('teardown is finished')
    t.end()
  })

  fxFulfilTest.end()
})
