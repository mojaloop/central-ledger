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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const retry = require('async-retry')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../src/lib/config')
const Time = require('@mojaloop/central-services-shared').Util.Time
const sleep = Time.sleep
const Db = require('@mojaloop/central-services-database').Db
const Cache = require('../../../src/lib/cache')
const Tb = require('../../../src/lib/tb')
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('../helpers/participant')
const ParticipantLimitHelper = require('../helpers/participantLimit')
const ParticipantFundsInOutHelper = require('../helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('../helpers/participantEndpoint')
const SettlementHelper = require('../helpers/settlementModels')
const HubAccountsHelper = require('../helpers/hubAccounts')
const TransferService = require('../../../src/domain/transfer')
const ParticipantService = require('../../../src/domain/participant')
const TransferExtensionModel = require('../../../src/models/transfer/transferExtension')
const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const {
  wrapWithRetries,
  getMessagePayloadOrThrow,
  sleepPromise
} = require('../../util/helpers')
const TestConsumer = require('../helpers/testConsumer')

const ParticipantCached = require('../../../src/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../src/models/participant/participantLimitCached')
const SettlementModelCached = require('../../../src/models/settlement/settlementModelCached')

const Handlers = {
  index: require('../../../src/handlers/register'),
  positions: require('../../../src/handlers/positions/handler'),
  transfers: require('../../../src/handlers/transfers/handler'),
  timeouts: require('../../../src/handlers/timeouts/handler')
}

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const TransferEventType = Enum.Events.Event.Type
const TransferEventAction = Enum.Events.Event.Action

const debug = false
const rebalanceDelay = 10000
const retryDelay = 500
const retryCount = 40
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
    const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.amount.currency)
    const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.amount.currency)

    const kafkacat = 'GROUP=abc; T=topic; TR=transfer; kafkacat -b localhost -G $GROUP $T-$TR-prepare $T-$TR-position $T-$TR-fulfil $T-$TR-get $T-admin-$TR $T-notification-event $T-bulk-prepare'
    if (debug) console.error(kafkacat)

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
    }

    const transferPayload = {
      transferId: Uuid(),
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
      id: Uuid(),
      from: transferPayload.payerFsp,
      to: transferPayload.payeeFsp,
      type: 'application/json',
      content: {
        headers: prepareHeaders,
        payload: transferPayload
      },
      metadata: {
        event: {
          id: Uuid(),
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
    messageProtocolFulfil.id = Uuid()
    messageProtocolFulfil.from = transferPayload.payeeFsp
    messageProtocolFulfil.to = transferPayload.payerFsp
    messageProtocolFulfil.content.headers = fulfilAbortRejectHeaders
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolFulfil.content.payload = fulfilPayload
    messageProtocolFulfil.metadata.event.id = Uuid()
    messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
    messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

    const messageProtocolReject = Util.clone(messageProtocolFulfil)
    messageProtocolReject.id = Uuid()
    messageProtocolFulfil.content.uriParams = { id: transferPayload.transferId }
    messageProtocolReject.content.payload = rejectPayload
    messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

    const messageProtocolError = Util.clone(messageProtocolFulfil)
    messageProtocolError.id = Uuid()
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
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await SettlementModelCached.initialize()
  await Cache.initCache()
  await SettlementHelper.prepareData()
  await HubAccountsHelper.prepareData()

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
    }
  ])

  await handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
    await registerAllHandlers.test('setup handlers', async (test) => {
      await Handlers.transfers.registerPrepareHandler()
      await Handlers.positions.registerPositionHandler()
      await Handlers.transfers.registerFulfilHandler()
      await Handlers.timeouts.registerTimeoutHandler()

      // Set up the testConsumer here
      await testConsumer.startListening()

      sleep(rebalanceDelay, debug, 'registerAllHandlers', 'awaiting registration of common handlers')

      test.pass('done')
      test.end()
    })

    await registerAllHandlers.end()
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
      const transfer = await wrapWithRetries(() => TransferService.getById(td.messageProtocolPrepare.content.payload.transferId))
      test.equal(transfer.transferState, 'RESERVED', 'Transfer is in reserved state')

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
        }))
        test.notOk('Should not be executed')
      } catch (err) {
        console.log(err)
        test.ok('No payee abort notification sent')
      }
      console.log(JSON.stringify(testConsumer.getAllEvents()))

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
      const transfer = await wrapWithRetries(() => TransferService.getById(td.messageProtocolPrepare.content.payload.transferId))
      test.equal(transfer.transferState, 'RESERVED', 'Transfer is in reserved state')

      // 2. sleep so that the RESERVED transfer expires
      await sleepPromise(2)

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
      const expectedAbortNotificationPayload = {
        completedTimestamp: Time.getUTCString(new Date(updatedTransfer.completedTimestamp)),
        transferState: 'ABORTED'
      }

      // Assert
      // 5. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
      const payerAbortNotification = (await wrapWithRetries(
        () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'commit' }))
      )[0]
      const payeeAbortNotification = (await wrapWithRetries(
        () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }))
      )[0]
      test.ok(payerAbortNotification, 'Payer Abort notification sent')
      test.ok(payeeAbortNotification, 'Payee Abort notification sent')

      test.deepEqual(
        getMessagePayloadOrThrow(payeeAbortNotification),
        expectedAbortNotificationPayload,
        'Abort notification should be sent with the correct values'
      )

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
      const transfer = await wrapWithRetries(() => TransferService.getById(td.messageProtocolPrepare.content.payload.transferId))
      test.equal(transfer.transferState, 'RESERVED', 'Transfer is in reserved state')

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
      const expectedAbortNotificationPayload = {
        completedTimestamp: Time.getUTCString(new Date(updatedTransfer.completedTimestamp)),
        transferState: 'ABORTED'
      }

      // Assert
      // 5. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
      try {
        const payerAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'commit' }))
        )[0]
        test.ok(payerAbortNotification, 'Payer Abort notification sent')
      } catch (err) {
        test.notOk('No payerAbortNotification was sent')
      }
      try {
        const payeeAbortNotification = (await wrapWithRetries(
          () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }))
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
      const transfer = await wrapWithRetries(() => TransferService.getById(td.messageProtocolPrepare.content.payload.transferId))
      test.equal(transfer.transferState, 'RESERVED', 'Transfer is in reserved state')

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

      await wrapWithRetries(async () => {
        const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
        return transfer.transferState === 'ABORTED_ERROR'
      })
      const updatedTransfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId)
      test.equal(updatedTransfer.transferState, 'ABORTED_ERROR', 'Transfer is in ABORTED_ERROR state')
      const expectedAbortNotificationPayload = {
        completedTimestamp: (new Date(Date.parse(updatedTransfer.completedTimestamp))).toISOString(),
        transferState: 'ABORTED'
      }

      // Assert
      // 3. Check that we sent 2 notifications to kafka - one for the Payee, one for the Payer
      const payerAbortNotificationEvent = (await wrapWithRetries(
        () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'abort-validation' }))
      )[0]
      const payeeAbortNotificationEvent = (await wrapWithRetries(
        () => testConsumer.getEventsForFilter({ topicFilter: 'topic-notification-event', action: 'reserved-aborted' }))
      )[0]
      test.ok(payerAbortNotificationEvent, 'Payer Abort notification sent')
      test.ok(payeeAbortNotificationEvent, 'Payee Abort notification sent')

      // grab kafka message
      const payerAbortNotificationPayload = getMessagePayloadOrThrow(payeeAbortNotificationEvent)

      test.equal(
        payerAbortNotificationPayload.transferState,
        expectedAbortNotificationPayload.transferState,
        'Abort notification should be sent with the correct transferState'
      )

      test.equal(
        payerAbortNotificationPayload.completedTimestamp,
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
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
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
        test.equal(transfer.transferState, TransferState.COMMITTED, `Transfer state changed to ${TransferState.COMMITTED}`)
        test.equal(transfer.fulfilment, td.fulfilPayload.fulfilment, 'Commit ilpFulfilment saved')
        test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position decremented by transfer amount and updated in participantPosition')
        test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        test.equal(payeePositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payee position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#2 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferFulfilCommit.end()
  })

  await handlersTest.test('tranferFulfilCommit with default settlement model should', async transferFulfilCommit => {
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
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
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
        test.equal(transfer.transferState, TransferState.COMMITTED, `Transfer state changed to ${TransferState.COMMITTED}`)
        test.equal(transfer.fulfilment, td.fulfilPayload.fulfilment, 'Commit ilpFulfilment saved')
        test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position decremented by transfer amount and updated in participantPosition')
        test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        test.equal(payeePositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payee position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#2 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
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
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#3 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })
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
        test.equal(transfer.transferState, TransferInternalState.ABORTED_REJECTED, `Transfer state changed to ${TransferInternalState.ABORTED_REJECTED}`)
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferInternalState.ABORTED_REJECTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#4 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
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
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#5 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
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
        test.equal(transfer.transferState, TransferInternalState.ABORTED_ERROR, `Transfer state changed to ${TransferInternalState.ABORTED_ERROR}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position decremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
        test.ok(transferError, 'A transfer error has been recorded')
        test.equal(transferError.errorCode, td.errorPayload.errorInformation.errorCode, 'Transfer error code matches')
        test.equal(transferError.errorDescription, expectedErrorDescription, 'Transfer error description matches')
        test.notEqual(transferError.transferStateChangeId, transfer.transferStateChangeId, 'Transfer error record is bound to previous state of transfer')
        test.ok(transferExtension, 'A transfer extension has been recorded')
        test.equal(transferExtension[0].transferId, transfer.transferId, 'Transfer extension recorded with transferErrorId key')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferInternalState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#6 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferAbort.end()
  })

  await handlersTest.test('timeout should', async timeoutTest => {
    testData.expiration = new Date((new Date()).getTime() + (2 * 1000)) // 2 seconds
    const td = await prepareTestData(testData)

    await timeoutTest.test('update transfer state to RESERVED by PREPARE request', async (test) => {
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
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async () => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`#7   Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
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
      await wrapWithRetries(payerPositionDidReset, 10, 4)
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
      await Tb.tbDestroy()
      await Cache.destroyCache()
      await Db.disconnect()

      assert.pass('database connection closed')
      await testConsumer.destroy()

      const topics = [
        'topic-transfer-prepare',
        'topic-transfer-position',
        'topic-transfer-fulfil',
        'topic-notification-event'
      ]
      for (const topic of topics) {
        try {
          await Producer.getProducer(topic).disconnect()
          assert.pass(`producer to ${topic} disconnected`)
        } catch (err) {
          assert.pass(err.message)
        }
      }
      for (const topic of topics) {
        try {
          await Consumer.getConsumer(topic).disconnect()
          assert.pass(`consumer to ${topic} disconnected`)
        } catch (err) {
          assert.pass(err.message)
        }
      }

      if (debug) {
        const elapsedTime = Math.round(((new Date()) - startTime) / 100) / 10
        console.log(`handlers.test.js finished in (${elapsedTime}s)`)
      }

      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  handlersTest.end()
})
