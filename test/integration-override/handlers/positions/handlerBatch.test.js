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
const { randomUUID } = require('crypto')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('#src/lib/config')
const Time = require('@mojaloop/central-services-shared').Util.Time
const sleep = Time.sleep
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
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
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
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    }
  ],
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
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }
    }
  ],
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

const testDataMixedWithLimitExceeded = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 5
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 5000
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }
    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
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

const testDataWithMixedCurrencies = {
  currencies: ['USD', 'XXX'],
  transfers: [
    {
      amount: {
        currency: 'USD',
        amount: 2
      }
    },
    {
      amount: {
        currency: 'XXX',
        amount: 3
      }
    },
    {
      amount: {
        currency: 'USD',
        amount: 4
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 5
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 6
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 7
      }

    },
    {
      amount: {
        currency: 'USD',
        amount: 8
      }

    },
    {
      amount: {
        currency: 'XXX',
        amount: 9
      }

    }
  ],
  payer: {
    name: 'payerFsp',
    limit: 1000,
    number: 1,
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

const _endpointSetup = async (participantName, baseURL) => {
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${baseURL}/transfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${baseURL}/transfers/{{transferId}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${baseURL}/transfers/{{transferId}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${baseURL}/bulkTransfers`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${baseURL}/bulkTransfers/{{id}}`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${baseURL}/bulkTransfers/{{id}}/error`)
  await ParticipantEndpointHelper.prepareData(participantName, 'FSPIOP_CALLBACK_URL_QUOTES', `${baseURL}`)
}

const prepareTestData = async (dataObj) => {
  try {
    const payerList = []
    const payeeList = []

    // Create Payers
    for (let i = 0; i < dataObj.payer.number; i++) {
      // Create payer
      const payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.currencies[0], dataObj.currencies[1])
      // limit,initial position and funds in
      payer.payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
        currency: dataObj.currencies[0],
        limit: { value: dataObj.payer.limit }
      })
      payer.payerLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payer.limit }
      })
      await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyId2, {
        currency: dataObj.currencies[0],
        amount: dataObj.payer.fundsIn
      })
      await ParticipantFundsInOutHelper.recordFundsIn(payer.participant.name, payer.participantCurrencyIdSecondary2, {
        currency: dataObj.currencies[1],
        amount: dataObj.payer.fundsIn
      })
      // endpoint setup
      await _endpointSetup(payer.participant.name, dataObj.endpoint.base)

      payerList.push(payer)
    }

    // Create Payees
    for (let i = 0; i < dataObj.payee.number; i++) {
      // Create payee
      const payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.currencies[0], dataObj.currencies[1])
      // limit,initial position
      payee.payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[0],
        limit: { value: dataObj.payee.limit }
      })
      payee.payeeLimitAndInitialPositionSecondaryCurrency = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
        currency: dataObj.currencies[1],
        limit: { value: dataObj.payee.limit }
      })
      // endpoint setup
      await _endpointSetup(payee.participant.name, dataObj.endpoint.base)
      payeeList.push(payee)
    }

    const kafkacat = 'GROUP=abc; T=topic; TR=transfer; kafkacat -b localhost -G $GROUP $T-$TR-prepare $T-$TR-position $T-$TR-position-batch $T-$TR-fulfil $T-$TR-get $T-admin-$TR $T-notification-event $T-bulk-prepare'
    if (debug) console.error(kafkacat)

    // Create payloads for number of transfers
    const transfersArray = []
    for (let i = 0; i < dataObj.transfers.length; i++) {
      const payer = payerList[i % payerList.length]
      const payee = payeeList[i % payeeList.length]

      const transferPayload = {
        transferId: randomUUID(),
        payerFsp: payer.participant.name,
        payeeFsp: payee.participant.name,
        amount: {
          currency: dataObj.transfers[i].amount.currency,
          amount: dataObj.transfers[i].amount.amount
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
    Logger.error(err)
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
      await KafkaHelper.producers.connect()
      sleep(rebalanceDelay, debug, 'registerAllHandlers', 'awaiting registration of common handlers')

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
    const fulfilConfig = Utility.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.PRODUCER,
      TransferEventType.TRANSFER.toUpperCase(),
      TransferEventType.FULFIL.toUpperCase())
    prepareConfig.logger = Logger
    fulfilConfig.logger = Logger

    await transferPositionPrepare.test('process batch of messages with mixed keys (accountIds) and update transfer state to RESERVED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
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
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.test('process batch of messages with payer limit reached and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataLimitExceeded)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare',
          errorCodeFilter: ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.code
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers payer limit aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPositionSecondaryCurrency.participantPosition.value
      test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position should not have changed')
      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.test('process batch of messages with not enough liquidity and update transfer state to ABORTED_REJECTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataLimitNoLiquidity)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare',
          errorCodeFilter: ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_FSP_INSUFFICIENT_LIQUIDITY.code
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers payer insufficient liquidity aborts')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPosition = td.transfersArray[0].payer.payerLimitAndInitialPositionSecondaryCurrency.participantPosition.value
      test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position should not have changed')

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.test('process batch of messages with some transfers having amount that exceeds NDC. Those transfers should be ABORTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataMixedWithLimitExceeded)

      // filter out the transferId for the transfer that will be aborted
      const transferIdForLimitExceeded = td.transfersArray.filter(transfer => transfer.transferPayload.amount.amount === 5000)[0].transferPayload.transferId
      console.log('transferIdForLimitExceeded:', transferIdForLimitExceeded)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      // Consume messages from notification topic
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionPrepare messages where destination is not Hub
      const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionPrepareFiltered.length, 3, 'Notification Messages received for all 3 transfers')

      // Check error code for the transfer that exceeded NDC
      positionPrepare.forEach((notification) => {
        console.log('notification:', notification)
        if (notification.content?.payload?.transferId === transferIdForLimitExceeded) {
          test.equal(notification.content.payload.errorInformation.errorCode, ErrorHandler.Enums.FSPIOPErrorCodes.PAYER_LIMIT_ERROR.code, 'Notification Messages received for transfer that exceeded NDC')
        }
      })

      // Check that payer position is only updated by sum of transfers that did not exceed NDC
      const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPosition = testDataMixedWithLimitExceeded.transfers[0].amount.amount + testDataMixedWithLimitExceeded.transfers[2].amount.amount
      test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position should only increase by the amounts that did not exceed NDC')

      // Check that the transfer state for transfers that exceeded NDC is ABORTED_REJECTED and for transfers that did not exceed NDC is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          // check if transferId is not transferIdForLimitExceeded
          if (tdTest.messageProtocolPrepare.content.payload.transferId === transferIdForLimitExceeded) {
            test.equal(transfer?.transferState, TransferInternalState.ABORTED_REJECTED, 'Transfer state updated to ABORTED_REJECTED')
          } else {
            test.equal(transfer?.transferState, TransferInternalState.RESERVED, 'Transfer state updated to RESERVED')
          }
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.test('process batch of transfers with mixed currencies', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testDataWithMixedCurrencies)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      // Consume messages from notification topic
      const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
        topicFilter: 'topic-notification-event',
        action: 'prepare'
      }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

      // filter positionPrepare messages where destination is not Hub
      const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
      test.equal(positionPrepareFiltered.length, 8, 'Notification Messages received for all 8 transfers')

      // Check that payer position is only updated by sum of transfers relevant to the currency
      const payerCurrentPositionForUSD = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyId) || {}
      const payerExpectedPositionForUSD = 20 // Sum of USD transfers in testDataWithMixedCurrencies
      test.equal(payerCurrentPositionForUSD.value, payerExpectedPositionForUSD, 'Payer position increases for USD transfers')

      const payerCurrentPositionForXXX = await ParticipantService.getPositionByParticipantCurrencyId(td.transfersArray[0].payer.participantCurrencyIdSecondary) || {}
      const payerExpectedPositionForXXX = 24 // Sum of XXX transfers in testDataWithMixedCurrencies
      test.equal(payerCurrentPositionForXXX.value, payerExpectedPositionForXXX, 'Payer position increases for XXX transfers')

      // Check that the transfer state for transfers is RESERVED
      try {
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          test.equal(transfer?.transferState, TransferInternalState.RESERVED, 'Transfer state updated to RESERVED')
        }
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()
      test.end()
    })

    await transferPositionPrepare.test('process batch of prepare/commit messages with mixed keys (accountIds) and update transfer state to COMMITTED', async (test) => {
      // Construct test data for 10 transfers. Default object contains 10 transfers.
      const td = await prepareTestData(testData)

      // Produce prepare messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolPrepare, td.topicConfTransferPrepare, prepareConfig)
      }

      try {
        const positionPrepare = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'prepare'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionPrepare messages where destination is not Hub
        const positionPrepareFiltered = positionPrepare.filter((notification) => notification.to !== 'Hub')
        test.equal(positionPrepareFiltered.length, 10, 'Notification Messages received for all 10 transfers')
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
        await tests(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }

      testConsumer.clearEvents()

      // Produce fulfil messages for transfersArray
      for (const transfer of td.transfersArray) {
        await Producer.produceMessage(transfer.messageProtocolFulfil, td.topicConfTransferFulfil, fulfilConfig)
      }
      try {
        const positionFulfil = await wrapWithRetries(() => testConsumer.getEventsForFilter({
          topicFilter: 'topic-notification-event',
          action: 'commit'
        }), wrapWithRetriesConf.remainingRetries, wrapWithRetriesConf.timeout)

        // filter positionFulfil messages where destination is not Hub
        const positionFulfilFiltered = positionFulfil.filter((notification) => notification.to !== 'Hub')
        test.equal(positionFulfilFiltered.length, 10, 'Notification Messages received for all 10 transfers')
      } catch (err) {
        test.notOk('Error should not be thrown')
        console.error(err)
      }

      const testsFulfil = async (totalTransferAmounts) => {
        for (const value of Object.values(totalTransferAmounts)) {
          const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(value.payee.participantCurrencyId) || {}
          const payeeInitialPosition = value.payee.payeeLimitAndInitialPosition.participantPosition.value
          const payeeExpectedPosition = payeeInitialPosition + value.totalTransferAmount
          const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
          test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position incremented by transfer amount and updated in participantPosition')
          test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        }
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const totalTransferAmounts = {}
        for (const tdTest of td.transfersArray) {
          const transfer = await TransferService.getById(tdTest.messageProtocolPrepare.content.payload.transferId) || {}
          if (transfer?.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `#1 Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          totalTransferAmounts[tdTest.payee.participantCurrencyId] = {
            payee: tdTest.payee,
            totalTransferAmount: (
              (totalTransferAmounts[tdTest.payee.participantCurrencyId] &&
                totalTransferAmounts[tdTest.payee.participantCurrencyId].totalTransferAmount) || 0
            ) - tdTest.transferPayload.amount.amount
          }
        }
        await testsFulfil(totalTransferAmounts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      testConsumer.clearEvents()
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
