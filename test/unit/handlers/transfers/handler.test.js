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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const { randomUUID } = require('crypto')
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Proxyquire = require('proxyquire')

const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const MainUtil = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const { Consumer } = require('@mojaloop/central-services-stream').Util

const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const Participant = require('../../../../src/domain/participant')
const Cyril = require('../../../../src/domain/fx/cyril')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const ilp = require('../../../../src/models/transfer/ilpPacket')
const ProxyCache = require('#src/lib/proxyCache')

const mocks = require('./mocks')
const TransferErrorModel = require('../../../../src/models/transfer/transferError')
const FxTransferErrorModel = require('../../../../src/models/fxTransfer/fxTransferError')
const FxTransferModel = require('../../../../src/models/fxTransfer/fxTransfer')

const TransferState = Enum.Transfers.TransferState

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
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

const messageProtocol = {
  id: randomUUID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp, 'content-type': 'application/vnd.interoperability.transfers+json;version=1.1' },
    uriParams: { id: transfer.transferId },
    payload: transfer
  },
  metadata: {
    event: {
      id: randomUUID(),
      type: 'prepare',
      action: 'prepare',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const getTransferId = randomUUID()
const getTransferMessageProtocol = {
  id: getTransferId,
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: {
      'fspiop-destination': transfer.payeeFsp,
      'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
    },
    uriParams: { id: getTransferId },
    payload: {
      transferId: getTransferId,
      transferState: TransferState.COMMITTED
    }
  },
  metadata: {
    event: {
      id: getTransferId,
      type: 'get',
      action: 'get',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageProtocolBulkPrepare = MainUtil.clone(messageProtocol)
messageProtocolBulkPrepare.metadata.event.action = 'bulk-prepare'
const messageProtocolBulkCommit = MainUtil.clone(messageProtocol)
messageProtocolBulkCommit.metadata.event.action = 'bulk-commit'

const messageProtocolGetFxTransfer = MainUtil.clone(getTransferMessageProtocol)
messageProtocolGetFxTransfer.metadata.event.action = 'fx-get'
messageProtocolGetFxTransfer.content.payload.commitRequestId = getTransferId

const messageProtocolGetTransferProxy = MainUtil.clone(getTransferMessageProtocol)
messageProtocolGetTransferProxy.content.headers['fspiop-proxy'] = 'proxyFsp'

const messageProtocolGetFxTransferProxy = MainUtil.clone(getTransferMessageProtocol)
messageProtocolGetFxTransferProxy.content.headers['fspiop-proxy'] = 'proxyFsp'
messageProtocolGetFxTransferProxy.metadata.event.action = 'fx-get'
messageProtocolGetFxTransferProxy.content.payload.commitRequestId = getTransferId

const topicName = 'topic-test'

const config = {
  options: {
    mode: 2,
    batchSize: 1,
    pollFrequency: 10,
    recursiveTimeout: 100,
    messageCharset: 'utf8',
    messageAsJSON: true,
    sync: true,
    consumeTimeout: 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    debug: 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  }
}

const command = () => {
}

let allTransferHandlers
let prepare
let createRemittanceEntity

const participants = ['testName1', 'testName2']

const cyrilStub = async (payload) => ({
  participantName: payload.payerFsp,
  currencyId: payload.amount.currency,
  amount: payload.amount.amount
})

Test('Transfer handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })
    sandbox.stub(ProxyCache, 'getProxyParticipantAccountDetails').resolves({ inScheme: true, participantCurrencyId: 1 })
    sandbox.stub(ProxyCache, 'checkSameCreditorDebtorProxy').resolves(false)
    const stubs = mocks.createTracerStub(sandbox)

    const EventSdkStub = {
      Tracer: stubs.TracerStub
    }

    createRemittanceEntity = Proxyquire('../../../../src/handlers/transfers/createRemittanceEntity', {
      '../../domain/fx/cyril': {
        getParticipantAndCurrencyForTransferMessage: cyrilStub,
        getParticipantAndCurrencyForFxTransferMessage: cyrilStub
      }
    })
    prepare = Proxyquire('../../../../src/handlers/transfers/prepare', {
      '@mojaloop/event-sdk': EventSdkStub,
      './createRemittanceEntity': createRemittanceEntity
    })
    allTransferHandlers = Proxyquire('../../../../src/handlers/transfers/handler', {
      '@mojaloop/event-sdk': EventSdkStub,
      './prepare': prepare
    })

    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.stub(Comparators)
    sandbox.stub(Validator)
    sandbox.stub(TransferService)
    sandbox.stub(FxTransferModel)
    sandbox.stub(TransferErrorModel)
    sandbox.stub(FxTransferErrorModel)
    TransferService.handlePayeeResponse.returns(Promise.resolve({}))
    sandbox.stub(Cyril)
    Cyril.processFulfilMessage.returns({
      isFx: false
    })
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(ilp)
    sandbox.stub(Kafka)
    sandbox.stub(MainUtil.StreamingProtocol)
    sandbox.stub(TransferObjectTransform, 'toTransfer')
    sandbox.stub(TransferObjectTransform, 'toFulfil')
    sandbox.stub(Participant, 'getAccountByNameAndCurrency').callsFake((...args) => {
      if (args[0] === transfer.payerFsp) {
        return {
          participantCurrencyId: 0
        }
      }
      if (args[0] === transfer.payeeFsp) {
        return {
          participantCurrencyId: 1
        }
      }
    })
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('reject should', rejectTest => {
    rejectTest.test('throw', async (test) => {
      try {
        // todo: clarify, what the test is about?
        await allTransferHandlers.reject()
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    rejectTest.end()
  })

  transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
    registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('register a consumer on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('throw error retrieveAllParticipants', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('return empty array retrieveAllParticipants', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('throw error registerFulfilHandler', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerFulfilHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('throw error registerTransferHandler', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerTransferHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('registerPrepareHandlers topic list is passed', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await allTransferHandlers.registerPrepareHandlers(participants)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.end()
  })

  transferHandlerTest.end()
})
