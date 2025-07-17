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

* Kevin Leyow <kevin.leyow@infitx.com>
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
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const Util = require('@mojaloop/central-services-shared').Util
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
const TransferService = require('#src/domain/transfer/index')
const FxTransferService = require('#src/domain/fx/index')
const ParticipantService = require('#src/domain/participant/index')

const Handlers = {
  index: require('#src/handlers/register'),
  positions: require('#src/handlers/positions/handler'),
  transfers: require('#src/handlers/transfers/handler'),
  timeouts: require('#src/handlers/timeouts/handler')
}
const TransferStateEnum = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action

const debug = process?.env?.test_INT_DEBUG || false
const rebalanceDelay = process?.env?.test_INT_REBALANCE_DELAY || 10000
const retryDelay = process?.env?.test_INT_RETRY_DELAY || 2
const retryCount = process?.env?.test_INT_RETRY_COUNT || 40
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
  proxyAR: {
    name: 'proxyAR',
    limit: 99999
  },
  proxyRB: {
    name: 'proxyRB',
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
    const fxp = await ParticipantHelper.prepareData(dataObj.fxp.name, dataObj.currencies[0], dataObj.currencies[1])
    const proxyAR = await ParticipantHelper.prepareData(dataObj.proxyAR.name, dataObj.amount.currency, undefined, undefined, true)
    const proxyRB = await ParticipantHelper.prepareData(dataObj.proxyRB.name, dataObj.currencies[1], undefined, undefined, true)

    const payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.payer.limit }
    })
    const fxpPayerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.currencies[0],
      limit: { value: dataObj.fxp.limit }
    })
    const fxpPayerLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(fxp.participant.name, {
      currency: dataObj.currencies[1],
      limit: { value: dataObj.fxp.limit }
    })
    const proxyARLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(proxyAR.participant.name, {
      currency: dataObj.amount.currency,
      limit: { value: dataObj.proxyAR.limit }
    })
    const proxyRBLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(proxyRB.participant.name, {
      currency: dataObj.currencies[1],
      limit: { value: dataObj.proxyRB.limit }
    })

    await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
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
    await ParticipantFundsInOutHelper.recordFundsIn(proxyAR.participant.name, proxyAR.participantCurrencyId2, {
      currency: dataObj.amount.currency,
      amount: 10000
    })
    await ParticipantFundsInOutHelper.recordFundsIn(proxyRB.participant.name, proxyRB.participantCurrencyId2, {
      currency: dataObj.currencies[1],
      amount: 10000
    })

    let payee
    let payeeLimitAndInitialPosition
    let payeeLimitAndInitialPositionSecondaryCurrency
    if (dataObj.crossSchemeSetup) {
      payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.currencies[1], undefined)
      payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payee.limit }
      })
      payeeLimitAndInitialPositionSecondaryCurrency = null
    } else {
      payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.amount.currency, dataObj.currencies[1])
      payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.amount.currency,
        limit: { value: dataObj.payee.limit }
      })
      payeeLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payee.limit }
      })
    }

    for (const name of [payer.participant.name, payee.participant.name, proxyAR.participant.name, proxyRB.participant.name, fxp.participant.name]) {
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
    const transferPayload = {
      transferId,
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
      'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0'
    }
    const fxFulfilAbortRejectHeaders = {
      'fspiop-source': fxp.participant.name,
      'fspiop-destination': payer.participant.name,
      'content-type': 'application/vnd.interoperability.fxTransfers+json;version=2.0'
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
      determiningTransferId: transferId,
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

    const fxFulfilPayload = {
      fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
      completedTimestamp: dataObj.now,
      conversionState: 'RESERVED'
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
          proxyId: 'test',
          transferId: transferPayload.transferId
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

    const messageProtocolPrepareFxForwarded = {
      id: fxTransferPayload.commitRequestId,
      from: 'payerFsp',
      to: 'proxyFsp',
      type: 'application/json',
      content: {
        payload: {
          proxyId: 'test',
          commitRequestId: fxTransferPayload.commitRequestId
        }
      },
      metadata: {
        event: {
          id: transferPayload.transferId,
          type: TransferEventType.PREPARE,
          action: TransferEventAction.FX_FORWARDED,
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

    const messageProtocolFxFulfil = Util.clone(messageProtocolFxPrepare)
    messageProtocolFxFulfil.id = randomUUID()
    messageProtocolFxFulfil.from = fxTransferPayload.counterPartyFsp
    messageProtocolFxFulfil.to = fxTransferPayload.initiatingFsp
    messageProtocolFxFulfil.content.headers = fxFulfilAbortRejectHeaders
    messageProtocolFxFulfil.content.uriParams = { id: fxTransferPayload.commitRequestId }
    messageProtocolFxFulfil.content.payload = fxFulfilPayload
    messageProtocolFxFulfil.metadata.event.id = randomUUID()
    messageProtocolFxFulfil.metadata.event.type = TransferEventType.FULFIL
    messageProtocolFxFulfil.metadata.event.action = TransferEventAction.FX_RESERVE

    const messageProtocolReject = Util.clone(messageProtocolFulfil)
    messageProtocolReject.id = randomUUID()
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolReject.content.payload = rejectPayload
    messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

    const messageProtocolError = Util.clone(messageProtocolFulfil)
    messageProtocolError.id = randomUUID()
    messageProtocolError.content.uriParams = { id: transferPayload.transferId }
    messageProtocolError.content.payload = errorPayload
    messageProtocolError.metadata.event.action = TransferEventAction.ABORT

    const messageProtocolFxError = Util.clone(messageProtocolFxFulfil)
    messageProtocolFxError.id = randomUUID()
    messageProtocolFxError.content.uriParams = { id: fxTransferPayload.commitRequestId }
    messageProtocolFxError.content.payload = errorPayload
    messageProtocolFxError.metadata.event.action = TransferEventAction.FX_ABORT

    const topicConfTransferPrepare = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.PREPARE)
    const topicConfTransferFulfil = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.FULFIL)

    return {
      transferPayload,
      fxTransferPayload,
      fulfilPayload,
      fxFulfilPayload,
      rejectPayload,
      errorPayload,
      messageProtocolPrepare,
      messageProtocolPrepareForwarded,
      messageProtocolPrepareFxForwarded,
      messageProtocolFxPrepare,
      messageProtocolFxError,
      messageProtocolFulfil,
      messageProtocolFxFulfil,
      messageProtocolReject,
      messageProtocolError,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      payer,
      payerLimitAndInitialPosition,
      payee,
      payeeLimitAndInitialPosition,
      payeeLimitAndInitialPositionSecondaryCurrency,
      proxyAR,
      proxyARLimitAndInitialPosition,
      proxyRB,
      proxyRBLimitAndInitialPosition,
      fxp,
      fxpPayerLimitAndInitialPosition,
      fxpPayerLimitAndInitialPositionSecondaryCurrency
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

  await handlersTest.test('transferPrepare should', async transferPrepare => {
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

  await handlersTest.test('fxTransferPrepare should', async transferPrepare => {
    await transferPrepare.test('ignore non COMMITTED/ABORTED fxTransfer on duplicate request', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: TransferEventAction.FX_PREPARE,
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      await new Promise(resolve => setTimeout(resolve, 5000))
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      try {
        await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: TransferEventAction.FX_PREPARE,
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.notOk('Secondary position prepare message with key should not be found')
      } catch (err) {
        test.ok('Duplicate prepare message ignored')
        console.error(err)
      }
      test.end()
    })

    await transferPrepare.test('send fxTransfer information callback when fxTransfer is (RECEIVED_FULFIL_DEPENDENT) RESERVED on duplicate request', async (test) => {
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
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: TransferEventAction.FX_PREPARE,
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_RESERVE,
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RECEIVED_FULFIL_DEPENDENT, 'FxTransfer state updated to RECEIVED_FULFIL_DEPENDENT')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Resend fx-prepare after state is RECEIVED_FULFIL_DEPENDENT
      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      // Should send fxTransfer state in callback
      // Internal state RECEIVED_FULFIL_DEPENDENT maps to TransferStateEnum.RESERVED enumeration.
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_PREPARE_DUPLICATE
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare duplicate message with key found')
        // Check if the error message is correct
        test.equal(positionPrepare[0].value.content.payload.conversionState, TransferStateEnum.RESERVED)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.end()
    })

    await transferPrepare.test('send fxTransfer information callback when fxTransfer is COMMITTED on duplicate request', async (test) => {
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

      // Set up the fxTransfer
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: TransferEventAction.FX_PREPARE,
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)
      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_RESERVE,
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil notification message found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RECEIVED_FULFIL_DEPENDENT, 'FxTransfer state updated to RECEIVED_FULFIL_DEPENDENT')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Complete dependent transfer
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, fulfilConfig)
      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.PREPARE
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Prepare notification message found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)
      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.COMMIT
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Fulfil notification message found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Assert FXP notification message is produced
      try {
        const notifyFxp = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_NOTIFY
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(notifyFxp[0], 'FXP notify notification message found')
        test.equal(notifyFxp[0].value.content.payload.conversionState, TransferStateEnum.COMMITTED)
        test.equal(notifyFxp[0].value.content.uriParams.id, td.messageProtocolFxPrepare.content.payload.commitRequestId)
        test.ok(notifyFxp[0].value.content.payload.completedTimestamp)
        test.equal(notifyFxp[0].value.to, td.fxp.participant.name)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      // Resend fx-prepare after fxTransfer state is COMMITTED
      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      // Should send fxTransfer state in callback
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_PREPARE_DUPLICATE
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare duplicate notification found')
        // Check if the error message is correct
        test.equal(positionPrepare[0].value.content.payload.conversionState, TransferStateEnum.COMMITTED)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.end()
    })

    await transferPrepare.test('send fxTransfer information callback when fxTransfer is ABORTED on duplicate request', async (test) => {
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
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: TransferEventAction.FX_PREPARE,
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxError, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_ABORT,
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()

      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.ABORTED_ERROR, 'FxTransfer state updated to ABORTED_ERROR')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Resend fx-prepare after state is ABORTED_ERROR
      await new Promise(resolve => setTimeout(resolve, 2000))
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      // Should send fxTransfer state in callback
      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: TransferEventAction.FX_PREPARE_DUPLICATE
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare duplicate message with key found')
        // Check if the error message is correct
        test.equal(positionPrepare[0].value.content.payload.conversionState, TransferStateEnum.ABORTED)
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      test.end()
    })
    transferPrepare.end()
  })

  await handlersTest.test('transferForwarded should', async transferForwarded => {
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
      const expiringTestData = Util.clone(testData)
      expiringTestData.expiration = new Date((new Date()).getTime() + 5000)

      const td = await prepareTestData(expiringTestData)
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
      expiredTestData.expiration = new Date((new Date()).getTime() + 3000)

      const td = await prepareTestData(expiredTestData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      await new Promise(resolve => setTimeout(resolve, 3000))

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

  await handlersTest.test('transferFxForwarded should', async transferFxForwarded => {
    await transferFxForwarded.test('should update fxTransfer internal state on prepare event fx-forwarded action', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)

      await new Promise(resolve => setTimeout(resolve, 5000))

      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED_FORWARDED, 'FxTransfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferFxForwarded.test('not timeout fxTransfer in RESERVED_FORWARDED internal transfer state', async (test) => {
      const expiringTestData = Util.clone(testData)
      expiringTestData.expiration = new Date((new Date()).getTime() + 5000)

      const td = await prepareTestData(expiringTestData)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED_FORWARDED, 'FxTransfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED_FORWARDED, 'FxTransfer still in RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferFxForwarded.test('should be able to transition from RESERVED_FORWARDED to RECEIVED_FULFIL_DEPENDENT on fx-fulfil', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED_FORWARDED, 'FxTransfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Fulfil the fxTransfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RECEIVED_FULFIL_DEPENDENT, 'FxTransfer state updated to RECEIVED_FULFIL_DEPENDENT')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferFxForwarded.test('should be able to transition from RESERVED_FORWARDED to RECEIVED_ERROR and ABORTED_ERROR on fx-fulfil error', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position fx-prepare message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.RESERVED_FORWARDED, 'FxTransfer state updated to RESERVED_FORWARDED')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Fulfil the fxTransfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      console.log('messageProtocolFxError', td.messageProtocolFxError)
      await Producer.produceMessage(td.messageProtocolFxError, td.topicConfTransferFulfil, fulfilConfig)
      await new Promise(resolve => setTimeout(resolve, 5000))
      try {
        const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
        test.equal(fxTransfer?.fxTransferState, TransferInternalState.ABORTED_ERROR, 'FxTransfer state updated to ABORTED_ERROR')
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferFxForwarded.test('should create notification message if fxTransfer is not found', async (test) => {
      const td = await prepareTestData(testData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)

      try {
        const notificationMessages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-forwarded'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(notificationMessages[0], 'notification message found')
        test.equal(notificationMessages[0].value.to, 'proxyFsp')
        test.equal(notificationMessages[0].value.from, 'payerFsp')
        test.equal(
          notificationMessages[0].value.content.payload.errorInformation.errorDescription,
          'Generic ID not found - Forwarded fxTransfer could not be found.'
        )
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferFxForwarded.test('should create notification message if transfer is found in incorrect state', async (test) => {
      const expiredTestData = Util.clone(testData)
      expiredTestData.expiration = new Date((new Date()).getTime() + 3000)

      const td = await prepareTestData(expiredTestData)
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)
      await new Promise(resolve => setTimeout(resolve, 3000))

      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
          if (fxTransfer?.fxTransferState !== TransferInternalState.EXPIRED_RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Send the prepare forwarded message after the prepare message has timed out
      await Producer.produceMessage(td.messageProtocolPrepareFxForwarded, td.topicConfTransferPrepare, prepareConfig)

      try {
        const notificationMessages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-forwarded'
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
    transferFxForwarded.end()
  })

  await handlersTest.test('transferFulfil should', async transferFulfil => {
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
    await transferProxyPrepare.test(`
      Scheme A: POST /fxTransfer call I.e. Debtor: Payer DFSP → Creditor: Proxy AR
      Payer DFSP position account must be updated (reserved)`, async (test) => {
      const creditor = 'regionalSchemeFXP'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAR.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolFxPrepare.to = creditor
      td.messageProtocolFxPrepare.content.headers['fspiop-destination'] = creditor
      td.messageProtocolFxPrepare.content.payload.counterPartyFsp = creditor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme A: POST /Transfer call I.e. Debtor: Proxy AR → Creditor: Proxy AR
      Do nothing (produce message with key 0)`, async (test) => {
      // Create dependent fxTransfer
      let creditor = 'regionalSchemeFXP'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAR.participant.name)

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

      td.messageProtocolFxPrepare.to = creditor
      td.messageProtocolFxPrepare.content.headers['fspiop-destination'] = creditor
      td.messageProtocolFxPrepare.content.payload.counterPartyFsp = creditor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Payer DFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Payer DFSP position account must be updated (reserved)
      let payerPositionAfterFxPrepare
      const tests = async () => {
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value
        const payerExpectedPosition = Number(payerInitialPosition) + Number(td.fxTransferPayload.sourceAmount.amount)
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerExpectedPosition), 'Payer position incremented by transfer amount and updated in participantPosition')
        test.ok(new MLNumber(payerPositionChange.value).isEqualTo(payerCurrentPosition.value), 'Payer position change value inserted and matches the updated participantPosition value')
        payerPositionAfterFxPrepare = payerExpectedPosition
      }
      try {
        await wrapWithRetries(async () => {
          const fxTransfer = await FxTransferService.getByIdLight(td.messageProtocolFxPrepare.content.payload.commitRequestId) || {}
          Logger.warn(`fxTransfer: ${JSON.stringify(fxTransfer)}`)
          if (fxTransfer?.fxTransferState !== TransferInternalState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return fxTransfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        await tests()
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      td.messageProtocolFxFulfil.to = td.payer.participant.name
      td.messageProtocolFxFulfil.from = 'regionalSchemeFXP'
      td.messageProtocolFxFulfil.content.headers['fspiop-destination'] = td.payer.participant.name
      td.messageProtocolFxFulfil.content.headers['fspiop-source'] = 'regionalSchemeFXP'
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Fulfil notification found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Create subsequent transfer
      creditor = 'regionalSchemePayeeFsp'
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyAR.participant.name)

      td.messageProtocolPrepare.to = creditor
      td.messageProtocolPrepare.content.headers['fspiop-destination'] = creditor
      td.messageProtocolPrepare.content.payload.payeeFsp = creditor

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // To be keyed with 0
          keyFilter: '0'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key 0 found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Hard to test that the position messageKey=0 equates to doing nothing
      // so we'll just check that the positions are unchanged for the participants
      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
      test.ok(new MLNumber(payerCurrentPosition.value).isEqualTo(payerPositionAfterFxPrepare), 'Payer position unchanged')
      const proxyARCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.proxyAR.participantCurrencyId) || {}
      test.ok(new MLNumber(proxyARCurrentPosition.value).isEqualTo(td.proxyARLimitAndInitialPosition.participantPosition.value), 'FXP position unchanged')

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme R: POST /fxTransfer call I.e. Debtor: Proxy AR → Creditor: FXP
      Proxy AR position account in source currency must be updated (reserved)`, async (test) => {
      const debtor = 'jurisdictionalFspPayerFsp'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAR.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolFxPrepare.from = debtor
      td.messageProtocolFxPrepare.content.headers['fspiop-source'] = debtor
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = debtor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Proxy AR participantCurrencyId
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme R: POST /transfer call I.e. Debtor: FXP → Creditor: Proxy RB
      FXP position account in targeted currency must be updated (reserved)`, async (test) => {
      const debtor = 'jurisdictionalFspPayerFsp'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAR.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolFxPrepare.from = debtor
      td.messageProtocolFxPrepare.content.headers['fspiop-source'] = debtor
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = debtor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Proxy AR participantCurrencyId
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the fxTransfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      td.messageProtocolFxFulfil.to = debtor
      td.messageProtocolFxFulfil.content.headers['fspiop-destination'] = debtor

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Create subsequent transfer
      const creditor = 'regionalSchemePayeeFsp'
      await ProxyCache.getCache().addDfspIdToProxyMapping(creditor, td.proxyRB.participant.name)

      td.messageProtocolPrepare.to = creditor
      td.messageProtocolPrepare.content.headers['fspiop-destination'] = creditor
      td.messageProtocolPrepare.content.payload.payeeFsp = creditor

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // A position prepare message reserving the FXP's targeted currency account should be created
          // Specifically for this test the targetCurrency is XXX
          keyFilter: td.fxp.participantCurrencyIdSecondary.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of fxp target currency account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme B: POST /transfer call I.e. Debtor: Proxy RB → Creditor: Payee DFSP
      Proxy RB position account must be updated (reserved)`, async (test) => {
      const debtor = 'jurisdictionalFspPayerFsp'

      // Proxy RB and Payee are only set up to deal in XXX currency
      const td = await prepareTestData({
        ...testData,
        amount: {
          currency: 'XXX',
          amount: '100'
        },
        crossSchemeSetup: true
      })
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyRB.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolPrepare.from = debtor
      td.messageProtocolPrepare.content.headers['fspiop-source'] = debtor
      td.messageProtocolPrepare.content.payload.payerFsp = debtor
      td.messageProtocolPrepare.content.payload.amount.currency = 'XXX'

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // A position prepare message reserving the proxy of ProxyRB on it's XXX participant currency account
          keyFilter: td.proxyRB.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of proxyRB target currency account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    transferProxyPrepare.end()
  })

  await handlersTest.test('transferProxyFulfil should', async transferProxyPrepare => {
    await transferProxyPrepare.test(`
      Scheme B: PUT /transfers call I.e. From: Payee DFSP → To: Proxy RB
      Payee DFSP position account must be updated`, async (test) => {
      const transferPrepareFrom = 'schemeAPayerFsp'

      // Proxy RB and Payee are only set up to deal in XXX currency
      const td = await prepareTestData({
        ...testData,
        crossSchemeSetup: true,
        amount: {
          currency: 'XXX',
          amount: '100'
        }
      })
      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareFrom, td.proxyRB.participant.name)

      // Prepare the transfer
      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolPrepare.from = transferPrepareFrom
      td.messageProtocolPrepare.content.headers['fspiop-source'] = transferPrepareFrom
      td.messageProtocolPrepare.content.payload.payerFsp = transferPrepareFrom

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // A position prepare message reserving the proxy of ProxyRB on it's XXX participant currency account
          keyFilter: td.proxyRB.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of fxp target currency account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the transfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      td.messageProtocolFulfil.to = transferPrepareFrom
      td.messageProtocolFulfil.content.headers['fspiop-destination'] = transferPrepareFrom

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

    await transferProxyPrepare.test(`
      Scheme R: PUT /transfers call I.e. From: Proxy RB → To: Proxy AR
      If it is a normal transfer without currency conversion
      ProxyRB account must be updated`, async (test) => {
      const transferPrepareFrom = 'schemeAPayerFsp'
      const transferPrepareTo = 'schemeBPayeeFsp'

      // In this particular test, without currency conversion proxyRB and proxyAR
      // should have accounts in the same currency. proxyRB default currency is already XXX.
      // So configure proxy AR to operate in XXX currency.
      const td = await prepareTestData({
        ...testData,
        amount: {
          currency: 'XXX',
          amount: '100'
        },
        crossSchemeSetup: true
      })

      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareFrom, td.proxyAR.participant.name)
      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareTo, td.proxyRB.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolPrepare.from = transferPrepareFrom
      td.messageProtocolPrepare.to = transferPrepareTo
      td.messageProtocolPrepare.content.headers['fspiop-source'] = transferPrepareFrom
      td.messageProtocolPrepare.content.headers['fspiop-destination'] = transferPrepareTo
      td.messageProtocolPrepare.content.payload.payerFsp = transferPrepareFrom
      td.messageProtocolPrepare.content.payload.payeeFsp = transferPrepareTo

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of proxyAR account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the transfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      td.messageProtocolFulfil.from = transferPrepareTo
      td.messageProtocolFulfil.to = transferPrepareFrom
      td.messageProtocolFulfil.content.headers['fspiop-source'] = transferPrepareTo
      td.messageProtocolFulfil.content.headers['fspiop-destination'] = transferPrepareFrom

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.proxyRB.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme R: PUT /fxTransfer call I.e. From: FXP → To: Proxy AR
      No position changes should happen`, async (test) => {
      const debtor = 'jurisdictionalFspPayerFsp'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAR.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolFxPrepare.from = debtor
      td.messageProtocolFxPrepare.content.headers['fspiop-source'] = debtor
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = debtor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Proxy AR participantCurrencyId
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the fxTransfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      td.messageProtocolFxFulfil.to = debtor
      td.messageProtocolFxFulfil.content.headers['fspiop-destination'] = debtor

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme R: PUT /fxTransfer call I.e. From: FXP → To: Proxy AR
      with wrong headers - ABORT VALIDATION`, async (test) => {
      const debtor = 'jurisdictionalFspPayerFsp'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(debtor, td.proxyAR.participant.name)

      const prepareConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      prepareConfig.logger = Logger

      td.messageProtocolFxPrepare.from = debtor
      td.messageProtocolFxPrepare.content.headers['fspiop-source'] = debtor
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = debtor
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Proxy AR participantCurrencyId
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with debtor key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the fxTransfer
      const fulfilConfig = Utility.getKafkaConfig(
        Config.KAFKA_CONFIG,
        Enum.Kafka.Config.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      fulfilConfig.logger = Logger

      td.messageProtocolFxFulfil.to = debtor
      td.messageProtocolFxFulfil.content.headers['fspiop-destination'] = debtor

      // If initiatingFsp is proxy, fx fulfil handler doesn't validate fspiop-destination header.
      // But it should validate fspiop-source header, because counterPartyFsp is not a proxy.
      td.messageProtocolFxFulfil.content.headers['fspiop-source'] = 'wrongfsp'

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-abort-validation',
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme R: PUT /transfers call I.e. From: Proxy RB → To: Proxy AR
      If it is a FX transfer with currency conversion
      FXP and ProxyRB account must be updated`, async (test) => {
      const transferPrepareFrom = 'schemeAPayerFsp'
      const transferPrepareTo = 'schemeBPayeeFsp'

      // In this particular test, with currency conversion, we're assuming that proxyAR and proxyRB
      // operate in different currencies. ProxyRB's default currency is XXX, and ProxyAR's default currency is USD.
      const td = await prepareTestData({
        ...testData,
        crossSchemeSetup: true
      })
      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareFrom, td.proxyAR.participant.name)
      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareTo, td.proxyRB.participant.name)

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

      // FX Transfer from proxyAR to FXP
      td.messageProtocolFxPrepare.from = transferPrepareFrom
      td.messageProtocolFxPrepare.content.headers['fspiop-source'] = transferPrepareFrom
      td.messageProtocolFxPrepare.content.payload.initiatingFsp = transferPrepareFrom
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the Proxy AR participantCurrencyId
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with proxyAR key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the fxTransfer
      td.messageProtocolFxFulfil.to = transferPrepareFrom
      td.messageProtocolFxFulfil.content.headers['fspiop-destination'] = transferPrepareFrom
      td.messageProtocolFxFulfil.from = td.fxp.participant.name
      td.messageProtocolFxFulfil.content.headers['fspiop-source'] = td.fxp.participant.name

      testConsumer.clearEvents()
      Logger.warn(`td.messageProtocolFxFulfil: ${JSON.stringify(td.messageProtocolFxFulfil)}`)
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: transferPrepareFrom
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fxFulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Create subsequent transfer
      td.messageProtocolPrepare.from = transferPrepareFrom
      td.messageProtocolPrepare.to = transferPrepareTo
      td.messageProtocolPrepare.content.headers['fspiop-source'] = transferPrepareFrom
      td.messageProtocolPrepare.content.headers['fspiop-destination'] = transferPrepareTo
      td.messageProtocolPrepare.content.payload.payerFsp = transferPrepareFrom
      td.messageProtocolPrepare.content.payload.payeeFsp = transferPrepareTo

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // A position prepare message reserving the FXP's targeted currency account should be created
          keyFilter: td.fxp.participantCurrencyIdSecondary.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of fxp target currency account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the transfer
      td.messageProtocolFulfil.from = transferPrepareTo
      td.messageProtocolFulfil.to = transferPrepareFrom
      td.messageProtocolFulfil.content.headers['fspiop-source'] = transferPrepareTo
      td.messageProtocolFulfil.content.headers['fspiop-destination'] = transferPrepareFrom

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFulfil1 = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.fxp.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        const positionFulfil2 = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.proxyRB.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil1[0], 'Position fulfil message with key found')
        test.ok(positionFulfil2[0], 'Position fulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferProxyPrepare.test(`
      Scheme A: PUT /transfers call I.e. From: Proxy AR → To: Payer FSP
      If it is a FX transfer with currency conversion
      PayerFSP and ProxyAR account must be updated`, async (test) => {
      const transferPrepareTo = 'schemeBPayeeFsp'
      const fxTransferPrepareTo = 'schemeRFxp'

      const td = await prepareTestData({ ...testData, crossSchemeSetup: true })
      await ProxyCache.getCache().addDfspIdToProxyMapping(fxTransferPrepareTo, td.proxyAR.participant.name)
      await ProxyCache.getCache().addDfspIdToProxyMapping(transferPrepareTo, td.proxyAR.participant.name)

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

      // FX Transfer from payer to proxyAR
      td.messageProtocolFxPrepare.to = fxTransferPrepareTo
      td.messageProtocolFxPrepare.content.headers['fspiop-destination'] = fxTransferPrepareTo
      td.messageProtocolFxPrepare.content.payload.counterPartyFsp = fxTransferPrepareTo
      await Producer.produceMessage(td.messageProtocolFxPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'fx-prepare',
          // To be keyed with the PayerFSP participantCurrencyId
          keyFilter: td.payer.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with proxyAR key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Fulfil the fxTransfer
      td.messageProtocolFulfil.from = fxTransferPrepareTo
      td.messageProtocolFulfil.content.headers['fspiop-source'] = fxTransferPrepareTo

      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFxFulfil, td.topicConfTransferFulfil, fulfilConfig)

      try {
        const positionFxFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'fx-reserve',
          valueToFilter: td.payer.name
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFxFulfil[0], 'Position fxFulfil message with key found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      // Create subsequent transfer
      td.messageProtocolPrepare.to = transferPrepareTo
      td.messageProtocolPrepare.content.headers['fspiop-destination'] = transferPrepareTo
      td.messageProtocolPrepare.content.payload.payeeFsp = transferPrepareTo

      await Producer.produceMessage(td.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'prepare',
          // A position prepare message without need for any position changes should be created (key 0)
          keyFilter: '0'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionPrepare[0], 'Position prepare message with key of fxp target currency account found')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        await wrapWithRetries(async () => {
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferInternalState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            return null
          }
          return transfer
        }, wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      // Fulfil the transfer
      td.messageProtocolFulfil.from = transferPrepareTo
      td.messageProtocolFulfil.content.headers['fspiop-source'] = transferPrepareTo
      testConsumer.clearEvents()
      await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)
      try {
        const positionFulfil1 = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-transfer-position-batch',
          action: 'commit',
          keyFilter: td.proxyAR.participantCurrencyId.toString()
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.ok(positionFulfil1[0], 'Position fulfil message with key found')
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
