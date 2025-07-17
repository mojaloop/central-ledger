/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * Vijaya Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const { randomUUID } = require('crypto')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('#src/lib/config')
const Db = require('../../../../src/lib/db')
const Cache = require('#src/lib/cache')
const ProxyCache = require('#src/lib/proxyCache')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Util = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const TransferService = require('#src/domain/transfer/index')
const FxTransferModels = require('#src/models/fxTransfer/index')
const ParticipantService = require('#src/domain/participant/index')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MLNumber = require('@mojaloop/ml-number')
const {
  wrapWithRetries
} = require('#test/util/helpers')
const TestConsumer = require('#test/integration/helpers/testConsumer')

const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const SettlementModelCached = require('#src/models/settlement/settlementModelCached')

const Handlers = {
  index: require('#src/handlers/register'),
  positions: require('#src/handlers/positions/handler'),
  transfers: require('#src/handlers/transfers/handler'),
  timeouts: require('#src/handlers/timeouts/handler')
}

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action

const debug = process?.env?.TEST_INT_DEBUG || false
const rebalanceDelay = process?.env?.TEST_INT_REBALANCE_DELAY || 20000
const retryDelay = process?.env?.TEST_INT_RETRY_DELAY || 2
const retryCount = process?.env?.TEST_INT_RETRY_COUNT || 40
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}
const TOPIC_POSITION = 'topic-transfer-position'
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
      condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
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
    messageProtocolPayerInitiatedConversionFxFulfil.from = fxTransferPayload.counterPartyFsp
    messageProtocolPayerInitiatedConversionFxFulfil.to = fxTransferPayload.initiatingFsp
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

    const topicConfFxTransferFulfil = Utility.createGeneralTopicConf(
      Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
      TransferEventType.TRANSFER,
      TransferEventType.FULFIL
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
      topicConfFxTransferFulfil,
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

Test('Handlers test', async handlersTest => {
  const startTime = new Date()
  await Db.connect(Config.DATABASE)
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await SettlementModelCached.initialize()
  await Cache.initCache()
  await SettlementHelper.prepareData()
  await HubAccountsHelper.prepareData()

  const wrapWithRetriesConf = {
    remainingRetries: retryOpts?.retries || 10, // default 10
    timeout: retryOpts?.maxTimeout || 2 // default 2
  }

  // Start a testConsumer to monitor events that our handlers emit
  const testConsumer = new TestConsumer([
    {
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.TRANSFER,
        Enum.Events.Event.Action.FULFIL
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.FULFIL.toUpperCase()
      )
    },
    {
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.NOTIFICATION,
        Enum.Events.Event.Action.EVENT
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.NOTIFICATION.toUpperCase(),
        Enum.Events.Event.Action.EVENT.toUpperCase()
      )
    },
    {
      topicName: TOPIC_POSITION,
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.POSITION.toUpperCase()
      )
    },
    {
      topicName: TOPIC_POSITION_BATCH,
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.POSITION.toUpperCase()
      )
    }
  ])

  await handlersTest.test('Setup kafka consumer should', async registerAllHandlers => {
    await registerAllHandlers.test('start consumer', async (test) => {
      // Set up the testConsumer here
      await testConsumer.startListening()

      // Disabling these handlers to test running the CL as a separate service independently.
      await new Promise(resolve => setTimeout(resolve, rebalanceDelay))
      testConsumer.clearEvents()

      test.pass('done')
      test.end()
      registerAllHandlers.end()
    })
  })

  await handlersTest.test('When only transfer is sent and followed by transfer abort', async abortTest => {
    const td = await prepareFxTestData(testFxData)

    await abortTest.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolSourcePrepare, td.topicConfTransferPrepare, config)
      Logger.info(producerResponse)

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolSourcePrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      test.end()
    })

    await abortTest.test('update transfer state to ABORTED by FULFIL-ABORT callback', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      await Producer.produceMessage(td.messageProtocolError, td.topicConfTransferFulfil, config)

      // Check for the transfer state to be ABORTED
      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolSourcePrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      test.end()
    })

    abortTest.end()
  })

  await handlersTest.test('When fxTransfer followed by a transfer and transferFulfilAbort are sent', async abortTest => {
    const td = await prepareFxTestData(testFxData)

    await abortTest.test('update fxTransfer state to RESERVED by PREPARE request', async (test) => {
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventAction.PREPARE.toUpperCase()
      )
      prepareConfig.logger = Logger

      await Producer.produceMessage(
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
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}
          if (fxTransfer?.transferState !== TransferInternalState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Check the position of the payer is updated
      const payerPositionAfterReserve = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId)
      test.ok(new MLNumber(payerPositionAfterReserve.value).isEqualTo(testFxData.sourceAmount.amount), 'Payer position incremented by source amount after reserve')

      testConsumer.clearEvents()
      test.end()
    })

    await abortTest.test('update fxTransfer state to RECEIVED_FULFIL_DEPENDENT by FULFIL request', async (test) => {
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventAction.FULFIL.toUpperCase()
      )
      fulfilConfig.logger = Logger

      await Producer.produceMessage(
        td.messageProtocolPayerInitiatedConversionFxFulfil,
        td.topicConfFxTransferFulfil,
        fulfilConfig
      )

      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: TOPIC_POSITION_BATCH,
          action: Enum.Events.Event.Action.FX_RESERVE
          // NOTE: The key is the fxp participantCurrencyId of the source currency (USD)
          //       Is that correct...?
          // keyFilter: td.fxp.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil[0], 'Position fx-fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(
            td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}

          if (fxTransfer?.transferState !== TransferInternalState.RECEIVED_FULFIL_DEPENDENT) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await abortTest.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)
      Logger.info(producerResponse)

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Check the position of the fxp is updated
      const fxpTargetPositionAfterReserve = await ParticipantService.getPositionByParticipantCurrencyId(td.fxp.participantCurrencyIdSecondary)
      test.ok(new MLNumber(fxpTargetPositionAfterReserve.value).isEqualTo(testFxData.targetAmount.amount), 'FXP target position incremented by target amount after reserve')

      testConsumer.clearEvents()
      test.end()
    })

    await abortTest.test('update transfer state to ABORTED by FULFIL-ABORT callback', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      await Producer.produceMessage(td.messageProtocolError, td.topicConfTransferFulfil, config)

      // Check for the transfer state to be ABORTED
      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Check for the fxTransfer state to be ABORTED
      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(
            td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}
          if (fxTransfer?.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Check the position of the payer is reverted
      const payerPositionAfterAbort = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId)
      test.ok(new MLNumber(payerPositionAfterAbort.value).isEqualTo(0), 'Payer position reverted to 0 after abort')

      // Check the position of the fxp is reverted
      const fxpTargetPositionAfterAbort = await ParticipantService.getPositionByParticipantCurrencyId(td.fxp.participantCurrencyIdSecondary)
      test.ok(new MLNumber(fxpTargetPositionAfterAbort.value).isEqualTo(0), 'FXP target position reverted to 0 after abort')

      // Check the position of the payee is not changed
      const payeePositionAfterAbort = await ParticipantService.getPositionByParticipantCurrencyId(td.payee.participantCurrencyId)
      test.ok(new MLNumber(payeePositionAfterAbort.value).isEqualTo(0), 'Payee position not changed after abort')

      // Check the position of the fxp source currency is not changed
      const fxpSourcePositionAfterAbort = await ParticipantService.getPositionByParticipantCurrencyId(td.fxp.participantCurrencyId)
      test.ok(new MLNumber(fxpSourcePositionAfterAbort.value).isEqualTo(0), 'FXP source position not changed after abort')

      testConsumer.clearEvents()
      test.end()
    })

    abortTest.end()
  })

  await handlersTest.test('When there is an abort from FXP for fxTransfer', async abortTest => {
    const td = await prepareFxTestData(testFxData)

    await abortTest.test('update fxTransfer state to RESERVED by PREPARE request', async (test) => {
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventAction.PREPARE.toUpperCase()
      )
      prepareConfig.logger = Logger
      await Producer.produceMessage(
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
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}
          if (fxTransfer?.transferState !== TransferInternalState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await abortTest.test('update fxTransfer state to ABORTED by FULFIL-ABORT callback', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      await Producer.produceMessage(td.messageProtocolFxAbort, td.topicConfTransferFulfil, config)

      // Check for the fxTransfer state to be ABORTED
      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferModels.fxTransfer.getAllDetailsByCommitRequestId(
            td.messageProtocolPayerInitiatedConversionFxPrepare.content.payload.commitRequestId) || {}
          if (fxTransfer?.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    abortTest.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      await Handlers.timeouts.stop()
      await Cache.destroyCache()
      await Db.disconnect()
      assert.pass('database connection closed')
      await testConsumer.destroy() // this disconnects the consumers

      await Producer.disconnect()
      await ProxyCache.disconnect()

      if (debug) {
        const elapsedTime = Math.round(((new Date()) - startTime) / 100) / 10
        console.log(`handlers.test.js finished in (${elapsedTime}s)`)
      }

      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    } finally {
      handlersTest.end()
    }
  })
})
