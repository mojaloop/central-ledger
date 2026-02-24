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
const EventSdk = require('@mojaloop/event-sdk')

const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const Participant = require('../../../../src/domain/participant')
const Cyril = require('../../../../src/domain/fx/cyril')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const ilp = require('../../../../src/models/transfer/ilpPacket')
const ProxyCache = require('#src/lib/proxyCache')

const mocks = require('./mocks')
const externalParticipantCached = require('../../../../src/models/participant/externalParticipantCached')
const TransferErrorModel = require('../../../../src/models/transfer/transferError')
const FxTransferErrorModel = require('../../../../src/models/fxTransfer/fxTransferError')
const FxTransferModel = require('../../../../src/models/fxTransfer/fxTransfer')
const GetService = require('../../../../src/handlers/transfers/GetService')
const FxGetService = require('../../../../src/handlers/transfers/FxGetService')

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState

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

const transferReturn = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  amount: {
    currency: 'USD',
    amount: '433.88'
  },
  transferState: 'COMMITTED',
  transferStateEnumeration: 'COMMITTED',
  completedTimestamp: '2016-05-15T18:44:38.000Z',
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  fulfilment: 'uz0FAeutW6o8Mz7OmJh8ALX6mmsZCcIDOqtE01eo4uI',
  extensionList: [{
    key: 'key1',
    value: 'value1'
  }]
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

const messages = [
  {
    topic: topicName,
    value: messageProtocol
  },
  {
    topic: topicName,
    value: messageProtocolBulkPrepare
  }
]

const getMessages = [
  {
    topic: topicName,
    value: getTransferMessageProtocol
  },
  {
    topic: topicName,
    value: messageProtocolGetFxTransfer
  }
]

const getProxyMessages = [
  {
    topic: topicName,
    value: messageProtocolGetTransferProxy
  },
  {
    topic: topicName,
    value: messageProtocolGetFxTransferProxy
  }
]

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

let SpanStub
let allTransferHandlers
let prepare
let createRemittanceEntity

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
    SpanStub = stubs.SpanStub

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
    sandbox.stub(GetService.prototype)
    sandbox.stub(FxGetService.prototype)

    // Setup default service method stubs
    GetService.prototype.validateParticipant.resolves(true)
    GetService.prototype.getTransferDetails.resolves(transferReturn)
    GetService.prototype.getProxiedTransferDetails.resolves(transferReturn)
    GetService.prototype.validateParticipantTransfer.resolves()
    GetService.prototype.shouldReplyWithErrorCallback.returns(false)
    GetService.prototype.createTransferPayload.returns(transferReturn)
    GetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })
    GetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })
    GetService.prototype.isProxiedGet.returns(null)
    GetService.prototype.getExternalParticipant.resolves(null)

    FxGetService.prototype.validateParticipant.resolves(true)
    FxGetService.prototype.getFxTransferDetails.resolves(transferReturn)
    FxGetService.prototype.getProxiedFxTransferDetails.resolves(transferReturn)
    FxGetService.prototype.validateParticipantCommitRequest.resolves()
    FxGetService.prototype.shouldReplyWithErrorCallback.returns(false)
    FxGetService.prototype.createFxTransferPayload.returns(transferReturn)
    FxGetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })
    FxGetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })
    FxGetService.prototype.isProxiedGet.returns(null)
    FxGetService.prototype.getExternalParticipant.resolves(null)
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

  transferHandlerTest.test('register getTransferHandler should', registerTransferhandler => {
    registerTransferhandler.test('return a true when registering the transfer handler', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerGetTransferHandler(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    registerTransferhandler.test('return an error when registering the transfer handler.', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())
        await allTransferHandlers.registerGetTransferHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    registerTransferhandler.end()
  })

  transferHandlerTest.test('get transfer by id should', transformTransfer => {
    transformTransfer.test('return true on a single message', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return true on an array of messages', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when an error is passed in', async (test) => {
      try {
        const localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        await allTransferHandlers.getTransfer(true, localMessages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    transformTransfer.test('return an error when the Kafka topic is invalid', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is not found', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.rejects(new Error('Transfer not found'))
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is not found with autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.rejects(new Error('Transfer not found'))
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.rejects(new Error('Participant not involved'))
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer - autocommit disabled', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.rejects(new Error('Participant not involved'))
      Consumer.isConsumerAutoCommitEnabled.returns(false)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is found', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.resolves()
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('log an error when the transfer state is EXPIRED_RESERVED', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.proceed.returns(Promise.resolve(true))
      const transferResult = MainUtil.clone(transferReturn)
      transferResult.transferState = 'EXPIRED_RESERVED'
      transferResult.extensionList = []
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferResult)
      GetService.prototype.validateParticipantTransfer.resolves()

      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('log an error when general message cannot be produced', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.proceed.throws(new Error())
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      const transferResult = MainUtil.clone(transferReturn)
      transferResult.transferState = 'ABORTED_REJECTED'
      transferResult.extensionList = []
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferResult))

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({})

      try {
        await allTransferHandlers.getTransfer(null, localMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        test.ok(SpanStub.finish.calledWith('', expectedState))
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    transformTransfer.test('handle external participant transfer GET request', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination header to external participant
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'externalFsp',
        'proxy-header': 'proxyFsp'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.resolves()
      GetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })

      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle external participant transfer GET request with autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Consumer.isConsumerAutoCommitEnabled.returns(true)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination header to external participant
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'externalFsp'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.resolves()
      GetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })
      GetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle external participant transfer GET request without destination header', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Remove destination header
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers
      }
      delete localMessages[0].value.content.headers['fspiop-destination']

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle external participant transfer GET request for fx transfers', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination header to external participant
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'externalFsp'
      }

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getFxTransferDetails.resolves(transferReturn)
      FxGetService.prototype.validateParticipantCommitRequest.resolves()
      FxGetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })
      FxGetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle external participant transfer GET request for fx transfers with autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Consumer.isConsumerAutoCommitEnabled.returns(true)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination header to external participant
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'externalFsp'
      }

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getFxTransferDetails.resolves(transferReturn)
      FxGetService.prototype.validateParticipantCommitRequest.resolves()
      FxGetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle external participant transfer GET request for fx transfers without destination header', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Remove destination header
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers
      }
      delete localMessages[1].value.content.headers['fspiop-destination']

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getFxTransferDetails.resolves(transferReturn)
      FxGetService.prototype.validateParticipantCommitRequest.resolves()
      FxGetService.prototype.getExternalParticipant.resolves(null)

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy header validation when hasProxyHeader is true and isInvalidState', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant as proxy
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Return transfer in invalid state for proxy
      const invalidTransfer = {
        ...transferReturn,
        transferStateEnumeration: 'ABORTED',
        transferState: 'ABORTED_ERROR'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves(invalidTransfer)
      GetService.prototype.shouldReplyWithErrorCallback.returns(true)
      GetService.prototype.handleErrorCallback.resolves(true)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves(null)

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('handle proxy header validation for fx-get when hasProxyHeader is true and isInvalidState', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)

      // Mock external participant as proxy
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Return transfer in invalid state for proxy
      FxTransferModel.getAllDetailsByCommitRequestId.withArgs(localMessages[1].value.content.uriParams.id).returns(Promise.resolve({
        ...transferReturn,
        transferStateEnumeration: 'ABORTED',
        transferState: 'ABORTED_ERROR'
      }))

      // Return fx transfer in invalid state for proxy
      const fxTransferId = localMessages[1].value.content.uriParams.id
      FxTransferModel.getByCommitRequestId.withArgs(fxTransferId).returns(Promise.resolve({
        ...transferReturn,
        commitRequestId: fxTransferId,
        transferStateEnumeration: 'ABORTED',
        transferState: 'ABORTED_ERROR'
      }))

      // Mock the fx transfer error to trigger the if(transferError) branch
      FxTransferErrorModel.getByCommitRequestId.withArgs(fxTransferId).returns(Promise.resolve({
        errorCode: '3303',
        errorDescription: 'Transfer expired'
      }))

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('skip validation when proxy header exists and state is valid', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant as proxy with valid state
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'payeeFsp'
      })

      // Set destination header to proxy participant
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'payeeFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Return transfer in valid state
      const validTransfer = {
        ...transferReturn,
        transferState: 'COMMITTED'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves(validTransfer)
      GetService.prototype.shouldReplyWithErrorCallback.returns(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves({ name: 'payeeFsp' })

      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle interscheme transfer GET with proxy header and COMMITTED state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Service mocks
      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves({
        ...transferReturn,
        transferState: 'COMMITTED',
        transferStateEnumeration: 'COMMITTED',
        externalPayerName: 'externalPayer'
      })
      GetService.prototype.shouldReplyWithErrorCallback.returns(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves(null)
      GetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle interscheme fx transfer GET timeout with error callback', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Service mocks
      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getProxiedFxTransferDetails.resolves({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferStateEnumeration: 'ABORTED',
        externalInitiatingFspName: 'externalInitiator'
      })
      FxGetService.prototype.shouldReplyWithErrorCallback.returns(true)
      FxGetService.prototype.isProxiedGet.returns(true)
      FxGetService.prototype.getExternalParticipant.resolves(null)
      FxGetService.prototype.handleErrorCallback.callsFake(async () => {
        await Kafka.proceed()
        return true
      })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle interscheme GET without proxy header but with external participant', async (test) => {
      const localMessages = MainUtil.clone(getMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination header to external participant but no proxy header
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'externalFsp'
      }
      // Remove proxy header
      delete localMessages[0].value.content.headers['fspiop-proxy']

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getTransferDetails.resolves(transferReturn)
      GetService.prototype.validateParticipantTransfer.resolves()
      GetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })
      GetService.prototype.handleStandardGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle interscheme GET with successful state transfer', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves({
        ...transferReturn,
        transferState: 'COMMITTED',
        transferStateEnumeration: 'COMMITTED',
        externalPayerName: 'externalPayer'
      })
      GetService.prototype.shouldReplyWithErrorCallback.returns(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves(null)
      GetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle interscheme fx GET with successful state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getProxiedFxTransferDetails.resolves({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferStateEnumeration: 'COMMITTED',
        externalInitiatingFspName: 'externalInitiator'
      })
      FxGetService.prototype.shouldReplyWithErrorCallback.returns(false)
      FxGetService.prototype.isProxiedGet.returns(true)
      FxGetService.prototype.getExternalParticipant.resolves(null)
      FxGetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET state in RESERVED_FORWARDED - Do nothing', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({ name: 'internalFsp' })

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves({
        ...transferReturn,
        transferState: TransferInternalState.RESERVED_FORWARDED,
        transferStateEnumeration: TransferInternalState.RESERVED_FORWARDED,
        externalPayerName: 'externalPayer'
      })
      GetService.prototype.shouldReplyWithErrorCallback.returns(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves({ name: 'internalFsp' })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.notCalled, 'Kafka.proceed was not called')
      test.end()
    })

    transformTransfer.test('handle proxy GET validation - participant does not exist', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant doesn't exist
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set proxy header but participant validation fails
      localMessages[0].value.content.headers['fspiop-proxy'] = 'hubProxy'

      GetService.prototype.validateParticipant.resolves(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves(null)
      GetService.prototype.handleErrorCallback.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('handle fx transfer with valid state and external participant with proxy header', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination and proxy headers
      localMessages[1].value.metadata.event.action = 'fx-get'
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'externalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getProxiedFxTransferDetails.resolves({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferStateEnumeration: 'COMMITTED',
        transferState: 'COMMITTED',
        externalInitiatingFspName: 'externalInitiator'
      })
      FxGetService.prototype.shouldReplyWithErrorCallback.returns(false)
      FxGetService.prototype.isProxiedGet.returns(true)
      FxGetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })
      FxGetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle transfer with valid state and external participant with proxy header', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'externalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves({
        ...transferReturn,
        transferStateEnumeration: 'COMMITTED',
        transferState: 'COMMITTED',
        externalPayerName: 'externalPayer'
      })
      GetService.prototype.shouldReplyWithErrorCallback.returns(false)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })
      GetService.prototype.handleProxiedGetSuccess.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET when transfer not found with proxy header', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      GetService.prototype.validateParticipant.resolves(true)
      GetService.prototype.getProxiedTransferDetails.resolves(null)
      GetService.prototype.isProxiedGet.returns(true)
      GetService.prototype.getExternalParticipant.resolves(null)
      GetService.prototype.validateNotFoundError.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle fx proxy GET when fxTransfer not found with proxy header', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getProxiedFxTransferDetails.resolves(null)
      FxGetService.prototype.isProxiedGet.returns(true)
      FxGetService.prototype.getExternalParticipant.resolves(null)
      FxGetService.prototype.validateNotFoundError.callsFake(async () => { await Kafka.proceed() })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET with RESERVED_FORWARDED state for fx transfer', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves({
        name: 'externalFsp',
        isProxy: false
      })

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'externalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Service mocks for RESERVED_FORWARDED state
      FxGetService.prototype.validateParticipant.resolves(true)
      FxGetService.prototype.getProxiedFxTransferDetails.resolves({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferState: TransferInternalState.RESERVED_FORWARDED,
        transferStateEnumeration: TransferInternalState.RESERVED_FORWARDED
      })
      FxGetService.prototype.isProxiedGet.returns(true)
      FxGetService.prototype.getExternalParticipant.resolves({ name: 'externalFsp', isProxy: false })

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.notCalled, 'Kafka.proceed was not called for RESERVED_FORWARDED state')
      test.end()
    })

    transformTransfer.test('handle proxy GET validation for fx transfers - participant not validated', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(false)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET validation - participant not validated for regular transfer', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(false)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET with transfer in RESERVED state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Return transfer in RESERVED state
      TransferService.getById.withArgs(localMessages[0].value.content.uriParams.id).returns(Promise.resolve({
        ...transferReturn,
        transferState: 'RESERVED',
        transferStateEnumeration: 'RESERVED'
      }))

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET with fx transfer in RESERVED state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Return fx transfer in RESERVED state
      FxTransferModel.getAllDetailsByCommitRequestId.withArgs(localMessages[1].value.content.uriParams.id).returns(Promise.resolve({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferState: 'RESERVED',
        transferStateEnumeration: 'RESERVED'
      }))

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET with fx transfer in SETTLED state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)

      // Set up fx-get action
      localMessages[1].value.metadata.event.action = 'fx-get'

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[1].value.content.headers = {
        ...localMessages[1].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Return fx transfer in SETTLED state
      FxTransferModel.getAllDetailsByCommitRequestId.withArgs(localMessages[1].value.content.uriParams.id).returns(Promise.resolve({
        ...transferReturn,
        commitRequestId: localMessages[1].value.content.uriParams.id,
        transferState: 'SETTLED',
        transferStateEnumeration: 'SETTLED',
        externalInitiatingFspName: 'externalInitiator'
      }))

      const result = await allTransferHandlers.getTransfer(null, localMessages[1])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.test('handle proxy GET with transfer in SETTLED state', async (test) => {
      const localMessages = MainUtil.clone(getProxyMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)

      // Mock external participant
      sandbox.stub(externalParticipantCached, 'getByName').resolves(null)

      // Set destination and proxy headers
      localMessages[0].value.content.headers = {
        ...localMessages[0].value.content.headers,
        'fspiop-destination': 'internalFsp',
        'fspiop-proxy': 'hubProxy'
      }

      // Return transfer in SETTLED state
      TransferService.getById.withArgs(localMessages[0].value.content.uriParams.id).returns(Promise.resolve({
        ...transferReturn,
        transferState: 'SETTLED',
        transferStateEnumeration: 'SETTLED',
        externalPayerName: 'externalPayer'
      }))

      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')
      test.end()
    })

    transformTransfer.end()
  })

  transferHandlerTest.end()
})
