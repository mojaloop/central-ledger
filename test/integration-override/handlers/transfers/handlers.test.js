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

* Kevin Leyow <kevin.leyow@infitx.com>
--------------
**********/

'use strict'

const Test = require('tape')
const { randomUUID } = require('crypto')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('#src/lib/config')
const Db = require('@mojaloop/database-lib').Db
const Cache = require('#src/lib/cache')
const ProxyCache = require('#src/lib/proxyCache')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const {
  wrapWithRetries
} = require('#test/util/helpers')
const TestConsumer = require('#test/integration/helpers/testConsumer')

const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const SettlementModelCached = require('#src/models/settlement/settlementModelCached')
const TransferService = require('#src/domain/transfer/index')

const Handlers = {
  index: require('#src/handlers/register'),
  positions: require('#src/handlers/positions/handler'),
  transfers: require('#src/handlers/transfers/handler'),
  timeouts: require('#src/handlers/timeouts/handler')
}

const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action

const debug = process?.env?.TEST_INT_DEBUG || false
const rebalanceDelay = process?.env?.TEST_INT_REBALANCE_DELAY || 10000
const retryDelay = process?.env?.TEST_INT_RETRY_DELAY || 2
const retryCount = process?.env?.TEST_INT_RETRY_COUNT || 40
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}

const testData = {
  currencies: ['USD', 'XXX'],
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
  proxyAlpha: {
    name: 'proxyAlpha',
    limit: 99999
  },
  proxyBeta: {
    name: 'proxyBeta',
    limit: 99999
  },
  fxp: {
    name: 'testFxp',
    number: 1,
    limit: 1000
  },
  fxTransfer: {
    amount: {
      currency: 'USD',
      amount: 5
    },
    fx: {
      targetAmount: {
        currency: 'XXX',
        amount: 50
      }
    }
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
    const proxyAlpha = await ParticipantHelper.prepareData(dataObj.proxyAlpha.name, dataObj.amount.currency, undefined, true)
    const proxyBeta = await ParticipantHelper.prepareData(dataObj.proxyBeta.name, dataObj.amount.currency, undefined, true)
    const fxp = await ParticipantHelper.prepareData(dataObj.fxp.name, dataObj.currencies[0], dataObj.currencies[1])

    const payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.payer.limit }
    })
    const payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.payee.limit }
    })
    const proxyAlphaLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(proxyAlpha.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.proxyAlpha.limit }
    })
    const proxyBetaLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(proxyBeta.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.proxyBeta.limit }
    })
    const fxpPayerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.currencies[0],
      limit: { value: dataObj.fxp.limit }
    })
    const fxpPayerLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.currencies[1],
      limit: { value: dataObj.fxp.limit }
    })
    await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
      currency: dataObj.amount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(proxyAlpha.participant.name, proxyAlpha.participantCurrencyId2, {
      currency: dataObj.amount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(proxyBeta.participant.name, proxyBeta.participantCurrencyId2, {
      currency: dataObj.amount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyId2, {
      currency: dataObj.currencies[0],
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(fxp.participant.name, fxp.participantCurrencyIdSecondary2, {
      currency: dataObj.currencies[1],
      amount: 10000
    })

    for (const name of [payer.participant.name, payee.participant.name, proxyAlpha.participant.name, proxyBeta.participant.name, fxp.participant.name]) {
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
    const fxPrepareHeaders = {
      'fspiop-source': payer.participant.name,
      'fspiop-destination': fxp.participant.name,
      'content-type': 'application/vnd.interoperability.fxtransfers+json;version=2.0'
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

    const fxTransferPayload = {
      commitRequestId: randomUUID(),
      determiningTransferId: randomUUID(),
      initiatingFsp: payer.participant.name,
      counterPartyFsp: fxp.participant.name,
      sourceAmount: {
        currency: dataObj.fxTransfer.amount.currency,
        amount: dataObj.fxTransfer.amount.amount.toString()
      },
      targetAmount: {
        currency: dataObj.fxTransfer.fx?.targetAmount.currency || dataObj.fxTransfer.amount.currency,
        amount: dataObj.fxTransfer.fx?.targetAmount.amount.toString() || dataObj.fxTransfer.amount.amount.toString()
      },
      condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
      expiration: dataObj.expiration
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

    const messageProtocolPrepareForwarded = {
      id: transferPayload.transferId,
      from: 'payerFsp',
      to: 'proxyFsp',
      type: 'application/json',
      content: {
        payload: {
          proxyId: 'test'
        }
      },
      metadata: {
        event: {
          id: transferPayload.transferId,
          type: TransferEventType.PREPARE,
          action: TransferEventAction.FORWARDED,
          createdAt: dataObj.now,
          state: {
            status: 'success',
            code: 0
          }
        }
      }
    }

    const messageProtocolFxPrepare = Util.clone(messageProtocolPrepare)
    messageProtocolFxPrepare.id = randomUUID()
    messageProtocolFxPrepare.from = fxTransferPayload.initiatingFsp
    messageProtocolFxPrepare.to = fxTransferPayload.counterPartyFsp
    messageProtocolFxPrepare.content.headers = fxPrepareHeaders
    messageProtocolFxPrepare.content.uriParams = { id: fxTransferPayload.commitRequestId }
    messageProtocolFxPrepare.content.payload = fxTransferPayload
    messageProtocolFxPrepare.metadata.event.id = randomUUID()
    messageProtocolFxPrepare.metadata.event.type = TransferEventType.PREPARE
    messageProtocolFxPrepare.metadata.event.action = TransferEventAction.FX_PREPARE

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
      fxTransferPayload,
      fulfilPayload,
      rejectPayload,
      errorPayload,
      messageProtocolPrepare,
      messageProtocolPrepareForwarded,
      messageProtocolFxPrepare,
      messageProtocolFulfil,
      messageProtocolReject,
      messageProtocolError,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      payer,
      payerLimitAndInitialPosition,
      payee,
      payeeLimitAndInitialPosition,
      proxyAlpha,
      proxyAlphaLimitAndInitialPosition,
      proxyBeta,
      proxyBetaLimitAndInitialPosition,
      fxp,
      fxpPayerLimitAndInitialPosition,
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
      topicName: 'topic-transfer-position-batch',
      config: Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.CONSUMER,
        Enum.Events.Event.Type.TRANSFER.toUpperCase(),
        Enum.Events.Event.Action.POSITION.toUpperCase()
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
      await ProxyCache.connect()
      testConsumer.clearEvents()
      test.pass('done')
      test.end()
      registerAllHandlers.end()
    })
  })

  await handlersTest.skip('transferPrepare should', async transferPrepare => {
    await transferPrepare.test('should create position prepare message to override topic name in config', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    transferPrepare.end()
  })

  await handlersTest.skip('transferForwarded should', async transferForwarded => {
    await transferForwarded.test('should update transfer internal state on prepare event forwarded action', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.RESERVED_FORWARDED, 'Transfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferForwarded.test('not timeout transfer in RESERVED_FORWARDED internal transfer state', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.RESERVED_FORWARDED, 'Transfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.RESERVED_FORWARDED, 'Transfer state is still RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferForwarded.test('should be able to transition from RESERVED_FORWARDED to RECEIVED_FULFIL and COMMITED on fulfil', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.RESERVED_FORWARDED, 'Transfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.payee.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.COMMITTED, 'Transfer state updated to COMMITTED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferForwarded.test('should be able to transition from RESERVED_FORWARDED to RECEIVED_ERROR and ABORTED_ERROR on fulfil error', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.RESERVED_FORWARDED, 'Transfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      await Producer.produceMessage(td.messageProtocolError, td.topicConfTransferFulfil, fulfilConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
        test.equal(transfer?.transferState, TransferInternalState.ABORTED_ERROR, 'Transfer state updated to ABORTED_ERROR')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferForwarded.test('should create notification message if transfer is not found', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      try {
        const notificationMessages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'forwarded'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(notificationMessages[0], 'notification message found')
        test.equal(notificationMessages[0].value.to, 'proxyFsp')
        test.equal(notificationMessages[0].value.from, 'payerFsp')
        test.equal(
          notificationMessages[0].value.content.payload.errorInformation.errorDescription,
          'Generic ID not found - Forwarded transfer could not be found.'
        )
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferForwarded.test('should create notification message if transfer is found in incorrect state', async (test) => {
      const expiredTestData = Util.clone(testData)
      expiredTestData.expiration = new Date((new Date()).getTime() + 1000)
      const td = await prepareTestData(expiredTestData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.EXPIRED_RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Send the prepare forwarded message after the prepare message has timed out
      await Producer.produceMessage(td.messageProtocolPrepareForwarded, td.topicConfTransferPrepare, prepareConfig)

      try {
        const notificationMessages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'forwarded'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(notificationMessages[0], 'notification message found')
        test.equal(notificationMessages[0].value.to, 'proxyFsp')
        test.equal(notificationMessages[0].value.from, 'payerFsp')
        test.equal(
          notificationMessages[0].value.content.payload.errorInformation.errorDescription,
          'Internal server error - Invalid State: EXPIRED_RESERVED - expected: RESERVED'
        )
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })
    transferForwarded.end()
  })

  await handlersTest.skip('transferFulfil should', async transferFulfil => {
    await transferFulfil.test('should create position fulfil message to override topic name in config', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.payee.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    transferFulfil.end()
  })

  await handlersTest.test('transferProxyPrepare should', async transferProxyPrepare => {
    await transferProxyPrepare.skip('should substitute debtor if not found in scheme and found in proxy cache (/transfers)', async (test) => {
      const debtor = 'notInSchemeFsp'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAlpha.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /transfer `payerFsp` with fsp not in scheme
      td.messageProtocolPrepare.content.payload.payerFsp = debtor
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.proxyAlpha.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with proxy key found')
        test.equal(positionPrepare[0].value.content.payload.payerFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.skip('should substitute creditor if not found in scheme and found in proxy cache (/transfers)', async (test) => {
      const creditor = 'notInSchemeFsp'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAlpha.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /transfer `payerFsp` with fsp not in scheme
      td.messageProtocolPrepare.content.payload.payeeFsp = creditor
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
        test.equal(positionPrepare[0].value.content.payload.payeeFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.skip('should substitute debtor & creditor if not found in scheme and found in proxy cache (/transfers)', async (test) => {
      const debtor = 'notInSchemeFspDebtor'
      const creditor = 'notInSchemeFspCreditor'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAlpha.participant.name)
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyBeta.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /transfer `payerFsp` with fsp not in scheme
      td.messageProtocolPrepare.content.payload.payerFsp = debtor
      td.messageProtocolPrepare.content.payload.payeeFsp = creditor
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.proxyAlpha.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
        test.equal(positionPrepare[0].value.content.payload.payerFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
        test.equal(positionPrepare[0].value.content.payload.payeeFsp, td.proxyBeta.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.skip('should produce position message with "0" key if both debtor and creditor are substitute with same proxy (/transfers)', async (test) => {
      const debtor = 'notInSchemeFspDebtor'
      const creditor = 'notInSchemeFspCreditor'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAlpha.participant.name)
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAlpha.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /transfer `payerFsp` with fsp not in scheme
      td.messageProtocolPrepare.content.payload.payerFsp = debtor
      td.messageProtocolPrepare.content.payload.payeeFsp = creditor
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: '0'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
        test.equal(positionPrepare[0].value.content.payload.payerFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
        test.equal(positionPrepare[0].value.content.payload.payeeFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.skip('should substitute debtor if not found in scheme and found in proxy cache (/fxTransfers)', async (test) => {
      const debtor = 'notInSchemeFsp'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAlpha.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /fxTransfer `initiatingFsp` with fsp not in scheme
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = debtor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.proxyAlpha.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with proxy key found')
        test.equal(positionPrepare[0].value.content.payload.initiatingFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test('should substitute creditor if not found in scheme and found in proxy cache (/fxTransfers)', async (test) => {
      const creditor = 'notInSchemeFsp'

      const td = await prepareTestData(testData)
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAlpha.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      // IMPORTANT: fspiop headers will always be the e2e parties, those are not the ones that will be substituted
      // Substitute /fxTransfer `counterPartyFsp` with fsp not in scheme
      td.messageProtocolFxPrepare.content.payload.counterPartyFsp = creditor
      console.log(td.messageProtocolFxPrepare)
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
        test.equal(positionPrepare[0].value.content.payload.counterPartyFsp, td.proxyAlpha.participant.name, 'Proxy participant substituted')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })
    transferProxyPrepare.end()
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
