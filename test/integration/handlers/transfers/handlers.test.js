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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const { randomUUID } = require('crypto')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../../dist/lib/config')
const ProxyCache = require('../../../../dist/lib/proxyCache')
const Time = require('@mojaloop/central-services-shared').Util.Time
const Db = require('../../../../dist/lib/db')
const Cache = require('../../../../dist/lib/cache')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const TransferService = require('../../../../dist/domain/transfer/index')
const ParticipantService = require('../../../../dist/domain/participant/index')
const TransferExtensionModel = require('../../../../dist/models/transfer/transferExtension')
const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const {
  wrapWithRetries,
  getMessagePayloadOrThrow,
  sleepPromise
} = require('#test/util/helpers')
const TestConsumer = require('#test/integration/helpers/testConsumer')

const ParticipantCached = require('../../../../dist/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../../dist/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../../dist/models/participant/participantLimitCached')
const SettlementModelCached = require('../../../../dist/models/settlement/settlementModelCached')

const Handlers = {
  index: require('../../../../dist/handlers/register'),
  positions: require('../../../../dist/handlers/positions/handler'),
  transfers: require('../../../../dist/handlers/transfers/handler'),
  timeouts: require('../../../../dist/handlers/timeouts/handler')
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

const testData = {
  amount: {
    currency: 'USD',
    amount: 110
  },
  payer: {
    name: 'payerFsp',
    limit: 500
  },
  payee: {
    name: 'payeeFsp',
    limit: 300
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataZAR = {
  amount: {
    currency: 'ZAR',
    amount: 110
  },
  payer: {
    name: 'payerFsp',
    limit: 500
  },
  payee: {
    name: 'payeeFsp',
    limit: 300
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const prepareTestData = async (dataObj) => {
  try {
    // TODO: START - Disabling these handlers to test running the CL as a separate service independently.
    //       The following issue https://github.com/mojaloop/project/issues/3112 was created to investigate as to why the Integration Tests are so unstable when then Event Handlers are executing in-line. For the time being the above PR clearly separates the process which resolves the stability issue for the time being.
    // // Lets make sure that all existing producers are connected
    // await KafkaHelper.producers.connect()
    // // Lets make sure that all existing Consumers are connected
    // await KafkaHelper.consumers.connect()
    // const topics = TestTopics.list
    // TODO: END - Disabling these handlers to test running the CL as a separate service independently.

    // // lets make sure all our Producers are already connected if they have already been defined.
    // for (const topic of topics) {
    //   try {
    //     // lets make sure check if any of our Producers are already connected if they have already been defined.
    //     console.log(`Producer[${topic}] checking connectivity!`)
    //     const isConnected = await Producer.isConnected(topic)
    //     if (!isConnected) {
    //       try {
    //         console.log(`Producer[${topic}] is connecting`)
    //         await Producer.getProducer(topic).connect()
    //         console.log(`Producer[${topic}] is connected`)
    //       } catch (err) {
    //         console.log(`Producer[${topic}] connection failed!`)
    //       }
    //     } else {
    //       console.log(`Producer[${topic}] is ALREADY connected`)
    //     }
    //   } catch (err) {
    //     console.log(`Producer[${topic}] has not been initialized`)
    //     console.error(err)
    //   }
    // }

    const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.amount.currency)
    const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.amount.currency)

    const payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.payer.limit }
    })
    const payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.payee.limit }
    })
    await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
      currency: dataObj.amount.currency,
      amount: 10000
    })

    for (const name of [payer.participant.name, payee.participant.name]) {
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

    const transferPayload = {
      transferId: randomUUID(),
      payerFsp: payer.participant.name,
      payeeFsp: payee.participant.name,
      amount: {
        currency: dataObj.amount.currency,
        amount: dataObj.amount.amount
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

    const prepareHeaders = {
      'fspiop-source': payer.participant.name,
      'fspiop-destination': payee.participant.name,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    }
    const fulfilAbortRejectHeaders = {
      'fspiop-source': payee.participant.name,
      'fspiop-destination': payer.participant.name,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    }

    const fulfilPayload = {
      fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
      completedTimestamp: dataObj.now,
      transferState: 'COMMITTED',
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

    const rejectPayload = Object.assign({}, fulfilPayload, { transferState: TransferInternalState.ABORTED_REJECTED })

    const errorPayload = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_FSP_REJECTED_TXN).toApiErrorObject()
    errorPayload.errorInformation.extensionList = { extension: [{ key: 'errorDetail', value: 'This is an abort extension' }] }

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

    const messageProtocolFulfil = Util.clone(messageProtocolPrepare)
    messageProtocolFulfil.id = randomUUID()
    messageProtocolFulfil.from = transferPayload.payeeFsp
    messageProtocolFulfil.to = transferPayload.payerFsp
    messageProtocolFulfil.content.headers = fulfilAbortRejectHeaders
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolFulfil.content.payload = fulfilPayload
    messageProtocolFulfil.metadata.event.id = randomUUID()
    messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
    messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

    const messageProtocolReject = Util.clone(messageProtocolFulfil)
    messageProtocolReject.id = randomUUID()
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolReject.content.payload = rejectPayload
    messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

    const messageProtocolError = Util.clone(messageProtocolFulfil)
    messageProtocolError.id = randomUUID()
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolError.content.payload = errorPayload
    messageProtocolError.metadata.event.action = TransferEventAction.ABORT

    const topicConfTransferPrepare = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.PREPARE)
    const topicConfTransferFulfil = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.FULFIL)

    return {
      transferPayload,
      fulfilPayload,
      rejectPayload,
      errorPayload,
      messageProtocolPrepare,
      messageProtocolFulfil,
      messageProtocolReject,
      messageProtocolError,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      payer,
      payerLimitAndInitialPosition,
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
  await ProxyCache.connect()
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
      topicName: Utility.transformGeneralTopicName(
        Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
        Enum.Events.Event.Type.TRANSFER,
        Enum.Events.Event.Action.POSITION
      ),
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.POSITION.toUpperCase()
      )
    }
  ])

  await handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
    await registerAllHandlers.test('setup handlers', async (test) => {
      // TODO: START - Disabling these handlers to test running the CL as a separate service independently.
      //       The following issue https://github.com/mojaloop/project/issues/3112 was created to investigate as to why the Integration Tests are so unstable when then Event Handlers are executing in-line. For the time being the above PR clearly separates the process which resolves the stability issue for the time being.
      // await Handlers.transfers.registerPrepareHandler()
      // await Handlers.positions.registerPositionHandler()
      // await Handlers.transfers.registerFulfilHandler()
      // await Handlers.timeouts.registerTimeoutHandler()
      // TODO: END - Disabling these handlers to test running the CL as a separate service independently.

      // Set up the testConsumer here
      await testConsumer.startListening()

      // TODO: MIG - Disabling these handlers to test running the CL as a separate service independently.
      await new Promise(resolve => setTimeout(resolve, rebalanceDelay))
      testConsumer.clearEvents()

      test.pass('done')
      test.end()
      registerAllHandlers.end()
    })
  })

  await handlersTest.test('transferPrepare should', async transferPrepare => {
    await transferPrepare.test('should create position prepare message keyed with payer account id', async (test) => {
      // Arrange
      const td = await prepareTestData(testData)
      // 1. send a PREPARE request (from Payer)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      test.end()
    })

    transferPrepare.end()
  })

  await handlersTest.test('transferFulfilReserve should', async transferFulfilReserve => {
    await transferFulfilReserve.test('Does not send a RESERVED_ABORTED notification when the Payee aborts the transfer', async (test) => {
      // Arrange
      const td = await prepareTestData(testData)

      // 1. send a PREPARE request (from Payer)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      let transfer = {}
      try {
        transfer = await wrapWithRetries(async () => {
          // lets fetch the transfer
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
          // lets check its status, and if its what we expect return the result
          if (transfer?.transferState === 'RESERVED') return transfer
          // otherwise lets return nothing
          return null
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.equal(transfer?.transferState, 'RESERVED', 'Transfer is in reserved state')

      // 2. send an ABORTED request from Payee
      td.messageProtocolFulfil.metadata.event.action = TransferEventAction.RESERVE
      const completedTimestamp = Time.getUTCString(new Date())
      td.messageProtocolFulfil.content.payload = {
        ...td.messageProtocolFulfil.content.payload,
        completedTimestamp,
        transferState: 'ABORTED'
      }
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      // Assert
      // 3. Check that we didn't sent a notification for the Payee
      try {
        await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'reserved-aborted'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.notOk('Should not be executed')
      } catch (err) {
        console.log(err)
        test.ok('No payee abort notification sent')
      }
      if (debug) console.log(JSON.stringify(testConsumer.getAllEvents()))

      // TODO: I can't seem to find the payer abort notification in the log
      // is there something I'm missing here? Does it go to a different handler?

      // 4. Check that we sent 1 notification for the payer
      // const payerAbortNotification = (await wrapWithRetries(() => testConsumer.getEventsForFilter({
      //   topicFilter: 'topic-notification-event',
      //   action: 'abort'
      // })))[0]
      // test.ok(payerAbortNotification, 'Payer Abort notification sent')

      // Cleanup
      testConsumer.clearEvents()
      test.end()
    })

    await transferFulfilReserve.test('send a RESERVED_ABORTED notification if the transfer is expired', async (test) => {
      // Arrange
      const customTestData = {
        ...testData,
        expiration: new Date((new Date()).getTime() + (2 * 1000)) // 2 seconds
      }
      const td = await prepareTestData(customTestData)

      // 1. send a PREPARE request (from Payer)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      let transfer = {}
      try {
        transfer = await wrapWithRetries(async () => {
          // lets fetch the transfer
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
          // lets check its status, and if its what we expect return the result
          if (transfer?.transferState === 'RESERVED') return transfer
          // otherwise lets return nothing
          return null
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.equal(transfer?.transferState, 'RESERVED', 'Transfer is in reserved state')

      // 2. sleep so that the RESERVED transfer expires
      await sleepPromise(wrapWithRetriesConf.timeout)

      // 3. send a RESERVED request from Payee
      td.messageProtocolFulfil.metadata.event.action = TransferEventAction.RESERVE
      const completedTimestamp = Time.getUTCString(new Date())
      td.messageProtocolFulfil.content.payload = {
        ...td.messageProtocolFulfil.content.payload,
        completedTimestamp,
        transferState: 'RESERVED'
      }
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      // 4. Get the updated transfer since the completedTimestamp may have changed
      const updatedTransfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)

      let expectedAbortNotificationPayload = {}
      if (updatedTransfer) {
        expectedAbortNotificationPayload = {
          completedTimestamp: Time.getUTCString(new Date(updatedTransfer.completedTimestamp)),
          transferState: 'ABORTED'
        }
      }

      // Assert
      // 5. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
      let payerAbortNotification
      let payeeAbortNotification
      try {
        payerAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'commit' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
        payeeAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.ok(payerAbortNotification, 'Payer Abort notification sent')
      test.ok(payeeAbortNotification, 'Payee Abort notification sent')

      try {
        test.deepEqual(
          getMessagePayloadOrThrow(payeeAbortNotification),
          expectedAbortNotificationPayload,
          'Abort notification should be sent with the correct values'
        )
      } catch (err) {
        test.notOk('Error should not be thrown - getMessagePayloadOrThrow(payeeAbortNotification) failed!')
        console.error(err)
      }

      try {
        const positionAbort = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'timeout-reserved',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionAbort[0], 'Position timeout reserved message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Cleanup
      testConsumer.clearEvents()
      test.end()
    })

    await transferFulfilReserve.test('send a RESERVED_ABORTED notification when the transfer is not in a RESERVED state', async (test) => {
      // Arrange
      const td = await prepareTestData(testData)

      // 1. send a PREPARE request (from Payer)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      let transfer = {}
      try {
        transfer = await wrapWithRetries(async () => {
          // lets fetch the transfer
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
          // lets check its status, and if its what we expect return the result
          if (transfer?.transferState === 'RESERVED') return transfer
          // otherwise lets return nothing
          return null
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.equal(transfer?.transferState, 'RESERVED', 'Transfer is in reserved state')

      // 2. Modify the transfer in the DB
      await TransferService.saveTransferStateChange({
        transferId: transfer.transferId,
        transferStateId: 'INVALID'
      })

      // 3. send a RESERVED request from Payee
      td.messageProtocolFulfil.metadata.event.action = TransferEventAction.RESERVE
      const completedTimestamp = Time.getUTCString(new Date())
      td.messageProtocolFulfil.content.payload = {
        ...td.messageProtocolFulfil.content.payload,
        completedTimestamp,
        transferState: 'RESERVED'
      }
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      // 4. Get the updated transfer since the completedTimestamp may have changed
      const updatedTransfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)

      let expectedAbortNotificationPayload = {}
      if (updatedTransfer) {
        expectedAbortNotificationPayload = {
          completedTimestamp: Time.getUTCString(new Date(updatedTransfer.completedTimestamp)),
          transferState: 'ABORTED'
        }
      }

      // Assert
      // 5. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
      try {
        const payerAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'commit' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
        test.ok(payerAbortNotification, 'Payer Abort notification sent')
      } catch (err) {
        test.notOk('No payerAbortNotification was sent')
      }
      try {
        const payeeAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
        test.ok(payeeAbortNotification, 'Payee Abort notification sent')
        test.deepEqual(
          getMessagePayloadOrThrow(payeeAbortNotification),
          expectedAbortNotificationPayload,
          'Abort notification should be sent with the correct values'
        )
      } catch (err) {
        test.notOk('No payeeAbortNotification was sent')
      }

      // Cleanup
      testConsumer.clearEvents()
      test.end()
    })

    await transferFulfilReserve.test('send a RESERVED_ABORTED notification when the validation fails', async (test) => {
      // Arrange
      const td = await prepareTestData(testData)

      // 1. send a PREPARE request (from Payer)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      let transfer = {}
      try {
        transfer = await wrapWithRetries(async () => {
          // lets fetch the transfer
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
          // lets check its status, and if its what we expect return the result
          if (transfer?.transferState === 'RESERVED') return transfer
          // otherwise lets return nothing
          return null
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.equal(transfer?.transferState, 'RESERVED', 'Transfer is in reserved state')

      // 2. send a RESERVED request with an invalid validation(from Payee)
      td.messageProtocolFulfil.metadata.event.action = TransferEventAction.RESERVE
      const completedTimestamp = Time.getUTCString(new Date())
      td.messageProtocolFulfil.content.payload = {
        fulfilment: 'INVALIDZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
        completedTimestamp,
        transferState: 'RESERVED'
      }
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
          return transfer?.transferState === 'ABORTED_ERROR'
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        const positionAbortValidation = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'abort-validation',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionAbortValidation[0], 'Position abort message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const updatedTransfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
      test.equal(updatedTransfer?.transferState, 'ABORTED_ERROR', 'Transfer is in ABORTED_ERROR state')

      let expectedAbortNotificationPayload = {}
      if (updatedTransfer) {
        expectedAbortNotificationPayload = {
          completedTimestamp: (new Date(Date.parse(updatedTransfer.completedTimestamp))).toISOString(),
          transferState: 'ABORTED'
        }
      }

      let payerAbortNotificationEvent
      let payeeAbortNotificationEvent
      try {
        // Assert
        // 3. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
        payerAbortNotificationEvent = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'abort-validation' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
        payeeAbortNotificationEvent = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }),
          wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        )[0]
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.ok(payerAbortNotificationEvent, 'Payer Abort notification sent')
      test.ok(payeeAbortNotificationEvent, 'Payee Abort notification sent')

      // grab kafka message
      const payeeAbortNotificationPayload = getMessagePayloadOrThrow(payeeAbortNotificationEvent)

      test.equal(
        payeeAbortNotificationPayload.transferState,
        expectedAbortNotificationPayload.transferState,
        'Abort notification should be sent with the correct transferState'
      )

      test.equal(
        payeeAbortNotificationPayload.completedTimestamp,
        expectedAbortNotificationPayload.completedTimestamp,
        'Abort notification should be sent with the correct completedTimestamp'
      )

      // Cleanup
      testConsumer.clearEvents()
      test.end()
    })

    transferFulfilReserve.end()
  })

  await handlersTest.test('transferFulfilCommit should', async transferFulfilCommit => {
    const td = await prepareTestData(testData)

    await transferFulfilCommit.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value
        const payerExpectedPosition = payerInitialPosition + td.transferPayload.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferFulfilCommit.test('update transfer state to COMMITTED by FULFIL request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payee.participantCurrencyId) || {}
        const payeeInitialPosition = td.payeeLimitAndInitialPosition.participantPosition.value
        const payeeExpectedPosition = payeeInitialPosition - td.transferPayload.amount.amount
        const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer?.transferState, TransferState.COMMITTED, `Transfer state changed to ${TransferState.COMMITTED}`)
        test.equal(transfer.fulfilment, td.fulfilPayload.fulfilment, 'Commit ilpFulfilment saved')
        test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position decremented by transfer amount and updated in participantPosition')
        test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        test.equal(payeePositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payee position change record is bound to the corresponding transfer state change')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferFulfilCommit.test('transfer position fulfil should be keyed with payee account id', async (test) => {
      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'commit',
          keyFilter: td.payee.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      test.end()
    })

    transferFulfilCommit.end()
  })

  await handlersTest.test('transferFulfilCommit with default settlement model should', async transferFulfilCommit => {
    const td = await prepareTestData(testDataZAR)
    await transferFulfilCommit.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value
        const payerExpectedPosition = payerInitialPosition + td.transferPayload.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })
    await transferFulfilCommit.test('update transfer state to COMMITTED by FULFIL request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, config)
      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payee.participantCurrencyId) || {}
        const payeeInitialPosition = td.payeeLimitAndInitialPosition.participantPosition.value
        const payeeExpectedPosition = payeeInitialPosition - td.transferPayload.amount.amount
        const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer?.transferState, TransferState.COMMITTED, `Transfer state changed to ${TransferState.COMMITTED}`)
        test.equal(transfer.fulfilment, td.fulfilPayload.fulfilment, 'Commit ilpFulfilment saved')
        test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position decremented by transfer amount and updated in participantPosition')
        test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        test.equal(payeePositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payee position change record is bound to the corresponding transfer state change')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })
    transferFulfilCommit.end()
  })

  await handlersTest.test('transferFulfilReject should', async transferFulfilReject => {
    testData.amount.amount = 15
    const td = await prepareTestData(testData)

    await transferFulfilReject.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferFulfilReject.end()
  })

  await handlersTest.test('transferPrepareExceedLimit should', async transferPrepareExceedLimit => {
    testData.amount.amount = 1100
    const td = await prepareTestData(testData)

    await transferPrepareExceedLimit.test('fail the transfer if the amount is higher than the remaining participant limit', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, `Transfer state changed to ${TransferInternalState.ABORTED_REJECTED}`)
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.ABORTED_REJECTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferPrepareExceedLimit.end()
  })

  await handlersTest.test('transferAbort should', async transferAbort => {
    testData.amount.amount = 5
    const td = await prepareTestData(testData)

    await transferAbort.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferAbort.test('update transfer state to ABORTED_ERROR by PUT /transfers/{id}/error endpoint', async (test) => {
      const expectedErrorDescription = ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.PAYEE_FSP_REJECTED_TXN).toApiErrorObject().errorInformation.errorDescription
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolError, td.topicConfTransferFulfil, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerExpectedPosition = testData.amount.amount - td.transferPayload.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        const transferError = await TransferService.getTransferErrorByTransferId(transfer.transferId)
        const transferExtension = await TransferExtensionModel.getByTransferId(transfer.transferId, false, true)
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer?.transferState, TransferInternalState.ABORTED_ERROR, `Transfer state changed to ${TransferInternalState.ABORTED_ERROR}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position decremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
        test.ok(transferError, 'A transfer error has been recorded')
        test.equal(transferError.errorCode, td.errorPayload.errorInformation.errorCode, 'Transfer error code matches')
        test.equal(transferError.errorDescription, expectedErrorDescription, 'Transfer error description matches')
        test.notEqual(transferError.transferStateChangeId, transfer?.transferStateChangeId, 'Transfer error record is bound to previous state of transfer')
        test.ok(transferExtension, 'A transfer extension has been recorded')
        test.equal(transferExtension[0].transferId, transfer.transferId, 'Transfer extension recorded with transferErrorId key')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferAbort.test('transfer position abort should be keyed with payer account id', async (test) => {
      try {
        const positionAbort = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'abort',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionAbort[0], 'Position abort message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      test.end()
    })

    transferAbort.end()
  })

  await handlersTest.test('timeout should', async timeoutTest => {
    testData.expiration = new Date((new Date()).getTime() + (10 * 1000)) // 10 seconds
    const td = await prepareTestData(testData)

    await timeoutTest.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      const config = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, config)
      Logger.info(producerResponse)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value
        const payerExpectedPosition = payerInitialPosition + td.transferPayload.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer?.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer?.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      test.end()
    })

    await timeoutTest.test('update transfer after timeout with timeout status & error', async (test) => {
      // Arrange
      // Nothing to do here...

      // Act

      // Re-try function with conditions
      const inspectTransferState = async () => {
        try {
          // Fetch Transfer record
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}

          // Check Transfer for correct state
          if (transfer?.transferState === Enum.Transfers.TransferInternalState.EXPIRED_RESERVED) {
            // We have a Transfer with the correct state, lets check if we can get the TransferError record
            try {
              // Fetch the TransferError record
              const transferError = await TransferService.getTransferErrorByTransferId(td.messageProtocolPrepare.content.payload.transferId)
              // TransferError record found, so lets return it
              return {
                transfer,
                transferError
              }
            } catch (err) {
              // NO TransferError record found, so lets return the transfer and the error
              return {
                transfer,
                err
              }
            }
          } else {
            // NO Transfer with the correct state was found, so we return false
            return false
          }
        } catch (err) {
          // NO Transfer with the correct state was found, so we return false
          Logger.error(err)
          return false
        }
      }

      // wait until we inspect a transfer with the correct status, or return false if all re-try attempts have failed
      const result = await wrapWithRetries(inspectTransferState, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // Assert
      if (result === false) {
        test.fail(`Transfer['${td.messageProtocolPrepare.content.payload.transferId}'].TransferState failed to transition to ${Enum.Transfers.TransferInternalState.EXPIRED_RESERVED}`)
        test.end()
      } else {
        test.equal(result.transfer && result.transfer?.transferState, Enum.Transfers.TransferInternalState.EXPIRED_RESERVED, `Transfer['${td.messageProtocolPrepare.content.payload.transferId}'].TransferState = ${Enum.Transfers.TransferInternalState.EXPIRED_RESERVED}`)
        test.equal(result.transferError && result.transferError.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code, `Transfer['${td.messageProtocolPrepare.content.payload.transferId}'].transferError.errorCode = ${ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.code}`)
        test.equal(result.transferError && result.transferError.errorDescription, ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message, `Transfer['${td.messageProtocolPrepare.content.payload.transferId}'].transferError.errorDescription = ${ErrorHandler.Enums.FSPIOPErrorCodes.TRANSFER_EXPIRED.message}`)
        test.pass()
        test.end()
      }
    })

    await timeoutTest.test('transfer position timeout should be keyed with payer account id', async (test) => {
      try {
        const positionTimeout = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position',
          action: 'timeout-reserved',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionTimeout[0], 'Position timeout message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      test.end()
    })

    await timeoutTest.test('position resets after a timeout', async (test) => {
      // Arrange
      const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value

      // Act
      const payerPositionDidReset = async () => {
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId)
        return payerCurrentPosition.value === payerInitialPosition
      }
      // wait until we know the position reset, or throw after 5 tries
      await wrapWithRetries(payerPositionDidReset, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}

      // Assert
      test.equal(payerCurrentPosition.value, payerInitialPosition, 'Position resets after a timeout')
      test.end()
    })

    timeoutTest.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      await Handlers.timeouts.stop()
      await Cache.destroyCache()
      await Db.disconnect()
      await ProxyCache.disconnect()
      assert.pass('database connection closed')
      await testConsumer.destroy() // this disconnects the consumers

      await Producer.disconnect()

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
