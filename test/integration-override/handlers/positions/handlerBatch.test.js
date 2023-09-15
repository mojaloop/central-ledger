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

 * Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('#src/lib/config')
const Db = require('@mojaloop/database-lib').Db
const Cache = require('#src/lib/cache')
const Producer = require('@mojaloop/central-services-stream').Util.Producer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka
const Enum = require('@mojaloop/central-services-shared').Enum
const ParticipantHelper = require('#test/integration/helpers/participant')
const ParticipantLimitHelper = require('#test/integration/helpers/participantLimit')
const ParticipantFundsInOutHelper = require('#test/integration/helpers/participantFundsInOut')
const ParticipantEndpointHelper = require('#test/integration/helpers/participantEndpoint')
const SettlementHelper = require('#test/integration/helpers/settlementModels')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const TransferService = require('#src/domain/transfer/index')
const ParticipantService = require('#src/domain/participant/index')
const Util = require('@mojaloop/central-services-shared').Util
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const {
  wrapWithRetries
} = require('#test/util/helpers')
const TestConsumer = require('#test/integration/helpers/testConsumer')
const KafkaHelper = require('#test/integration/helpers/kafkaHelper')

const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const SettlementModelCached = require('#src/models/settlement/settlementModelCached')
const { sleepPromise } = require('../../../util/helpers')

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
// const rebalanceDelay = process?.env?.TEST_INT_REBALANCE_DELAY || 10000
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
    amount: 5
  },
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 2,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 1000
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitExceeded = {
  amount: {
    currency: 'USD',
    amount: 5
  },
  payer: {
    name: 'payerFsp',
    limit: 1, // Limit set low
    number: 1,
    fundsIn: 10000
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const testDataLimitNoLiquidity = {
  amount: {
    currency: 'USD',
    amount: 5
  },
  payer: {
    name: 'payerFsp',
    limit: 10000,
    number: 1,
    fundsIn: 1 // Low liquidity
  },
  payee: {
    name: 'payeeFsp',
    number: 2,
    limit: 0
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const _endpointSetup = async (participantName, baseURL) => {
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${baseURL}/transfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${baseURL}/transfers/{{transferId}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${baseURL}/transfers/{{transferId}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${baseURL}/bulkTransfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${baseURL}/bulkTransfers/{{id}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${baseURL}/bulkTransfers/{{id}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_QUOTES', `${baseURL}`)
}

const prepareTestData = async (dataObj, numberOfTransfers) => {
  try {
    const payerList = []
    const payeeList = []

    // Create Payers
    for (let i = 0; i < dataObj.payer.number; i++) {
      // Create payer
      const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.amount.currency)
      // limit,initial position and funds in
      payer.payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
        currency: dataObj.amount.currency,
        limit: { value: dataObj.payer.limit }
      })
      await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
        currency: dataObj.amount.currency,
        amount: dataObj.payer.fundsIn
      })
      // endpoint setup
      _endpointSetup(payer.participant.name, dataObj.endpoint.base)

      payerList.push(payer)
    }

    // Create Payees
    for (let i = 0; i < dataObj.payee.number; i++) {
      // Create payee
      const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.amount.currency)
      // limit,initial position
      payee.payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.amount.currency,
        limit: { value: dataObj.payee.limit }
      })
      // endpoint setup
      _endpointSetup(payee.participant.name, dataObj.endpoint.base)
      payeeList.push(payee)
    }

    const kafkacat = 'GROUP=abc; T=topic; TR=transfer; kafkacat -b localhost -G $GROUP $T-$TR-prepare $T-$TR-position $T-$TR-position-batch $T-$TR-fulfil $T-$TR-get $T-admin-$TR $T-notification-event $T-bulk-prepare'
    if (debug) console.error(kafkacat)

    // Create payloads for number of transfers
    const transfersArray = []
    for (let i = 0; i < numberOfTransfers; i++) {
      const payer = payerList[i % payerList.length]
      const payee = payeeList[i % payeeList.length]

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
          extension: []
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
      transfersArray.push({
        transferPayload,
        fulfilPayload,
        rejectPayload,
        errorPayload,
        messageProtocolPrepare,
        messageProtocolFulfil,
        messageProtocolReject,
        messageProtocolError,
        payer,
        payee
      })
    }
    const topicConfTransferPrepare = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.PREPARE)
    const topicConfTransferFulfil = Utility.createGeneralTopicConf(Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE, TransferEventType.TRANSFER, TransferEventType.FULFIL)
    return {
      payerList,
      payeeList,
      topicConfTransferPrepare,
      topicConfTransferFulfil,
      transfersArray
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

  await handlersTest.test('setup', async setupTests => {
    await setupTests.test('start testConsumer', async (test) => {
      // Set up the testConsumer here
      await testConsumer.startListening()
      test.pass('done')
      test.end()
    })

    await setupTests.end()
  })

  await handlersTest.test('position batch handler should', async transferPositionPrepare => {
    const prepareConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.PREPARE.toUpperCase())
    prepareConfig.logger = Logger

    await transferPositionPrepare.test('process batch of messages with mixed keys (accountIds) and update transfer state to RESERVED', async (test) => {
      // Construct test data for 10 transfers
      const td = await prepareTestData(testData, 10)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'event'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.equal(positionPrepare.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }
      const tests = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payer.participantCurrencyId) || {}
          const payerInitialPosition = value.payer.payerLimitAndInitialPosition.participantPosition.value
          const payerExpectedPosition = payerInitialPosition + value.totalTransferAmount
          const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
          test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
          test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        }
      }

      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          totalTransferAmounts[tdTest.payer.participantCurrencyId] = {
            payer: tdTest.payer,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payer.participantCurrencyId] &&
               totalTransferAmounts[tdTest.payer.participantCurrencyId].totalTransferAmount) || 0
            ) + tdTest.transferPayload.amount.amount
          }
        }
        Logger.info(totalTransferAmounts)
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      await sleepPromise(3)
      test.end()
    })

    await transferPositionPrepare.test('process batch of messages with payer limit reached and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers
      const td = await prepareTestData(testDataLimitExceeded, 10)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'event',
          errorCodeFilter: '4200'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.equal(positionPrepare.length, 10, 'Notification Messages received for all 10 transfers payer limit aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPosition.participantPosition.value
      test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position should not have changed')
      await sleepPromise(3)
      test.end()
    })

    await transferPositionPrepare.test('process batch of messages with not enough liquidity and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers
      const td = await prepareTestData(testDataLimitNoLiquidity, 10)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'event',
          errorCodeFilter: '4001'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)
        test.equal(positionPrepare.length, 10, 'Notification Messages received for all 10 transfers payer insufficient liquidity aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPosition.participantPosition.value
      test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position should not have changed')
      await sleepPromise(3)
      test.end()
    })
    transferPositionPrepare.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      await Handlers.timeouts.stop()
      await Cache.destroyCache()
      await Db.disconnect()
      assert.pass('database connection closed')
      await testConsumer.destroy()

      await KafkaHelper.producers.disconnect()
      await KafkaHelper.consumers.disconnect()

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
