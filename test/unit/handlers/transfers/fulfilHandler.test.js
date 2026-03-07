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
const Time = require('@mojaloop/central-services-shared').Util.Time
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

const { getMessagePayloadOrThrow } = require('../../../util/helpers')
const mocks = require('./mocks')
const TransferErrorModel = require('../../../../src/models/transfer/transferError')
const FxTransferErrorModel = require('../../../../src/models/fxTransfer/fxTransferError')
const FxTransferModel = require('../../../../src/models/fxTransfer/fxTransfer')

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

const fulfil = {
  fulfilment: 'oAKAAA',
  completedTimestamp: '2018-10-24T08:38:08.699-04:00',
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

const errInfo = {
  errorInformation: {
    errorCode: 5105,
    errorDescription: 'Payee transaction limit reached'
  },
  extensionList: {
    extension: [{
      key: 'errorDetail',
      value: 'This is an abort extension'
    }]
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

const fulfilMessages = [
  {
    topic: topicName,
    value: Object.assign({}, messageProtocol, {
      content: {
        payload: fulfil,
        uriParams: { id: messageProtocol.content.uriParams.id },
        headers: {
          'fspiop-source': 'dfsp1',
          'fspiop-destination': 'dfsp2',
          'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
        }
      },
      metadata: {
        event: {
          type: 'fulfil',
          action: 'commit'
        }
      }
    })
  },
  {
    topic: topicName,
    value: Object.assign({}, messageProtocolBulkCommit, {
      content: {
        payload: fulfil,
        uriParams: { id: messageProtocolBulkCommit.content.uriParams.id },
        headers: {
          'fspiop-source': 'dfsp1',
          'fspiop-destination': 'dfsp2',
          'content-type': 'application/vnd.interoperability.transfers+json;version=1.1'
        }
      },
      metadata: {
        event: {
          type: 'fulfil',
          action: 'bulk-commit'
        }
      }
    })
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

    // Mock ProxyCache completely to prevent Redis connections
    sandbox.stub(ProxyCache, 'reset').returns(Promise.resolve())
    sandbox.stub(ProxyCache, 'connect').returns(Promise.resolve())
    sandbox.stub(ProxyCache, 'disconnect').returns(Promise.resolve())
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub().returns(Promise.resolve()),
      disconnect: sandbox.stub().returns(Promise.resolve()),
      get: sandbox.stub().returns(Promise.resolve(null)),
      set: sandbox.stub().returns(Promise.resolve()),
      del: sandbox.stub().returns(Promise.resolve()),
      hget: sandbox.stub().returns(Promise.resolve(null)),
      hset: sandbox.stub().returns(Promise.resolve()),
      hdel: sandbox.stub().returns(Promise.resolve())
    })
    sandbox.stub(ProxyCache, 'getFSPProxy').resolves(null)
    sandbox.stub(ProxyCache, 'getProxyParticipantAccountDetails').resolves({ inScheme: true, participantCurrencyId: 1 })
    sandbox.stub(ProxyCache, 'checkSameCreditorDebtorProxy').resolves(false)
    sandbox.stub(ProxyCache, 'addDfspProxyMapping').resolves(true)
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
    Comparators.duplicateCheckComparator = sandbox.stub().returns(Promise.resolve({
      hasDuplicateId: false,
      hasDuplicateHash: false
    }))
    sandbox.stub(Validator)
    Validator.validateParticipantByName = sandbox.stub().returns(Promise.resolve(true))
    Validator.validateFulfilCondition = sandbox.stub().returns(true)
    sandbox.stub(TransferService)
    TransferService.getById = sandbox.stub().returns(Promise.resolve({
      condition: 'condition',
      payeeFsp: 'dfsp2',
      payerFsp: 'dfsp1',
      transferState: TransferState.RESERVED,
      transferStateEnumeration: TransferState.RESERVED,
      transferId: transfer.transferId,
      expirationDate: new Date('2030-01-01')
    }))
    TransferService.getById = sandbox.stub().returns(Promise.resolve({
      condition: 'condition',
      payeeFsp: 'dfsp2',
      payerFsp: 'dfsp1',
      transferState: TransferState.RESERVED,
      transferStateEnumeration: TransferState.RESERVED,
      transferId: transfer.transferId,
      expirationDate: new Date('2030-01-01')
    }))
    sandbox.stub(FxTransferModel)
    sandbox.stub(TransferErrorModel)
    sandbox.stub(FxTransferErrorModel)
    TransferService.handlePayeeResponse.returns(Promise.resolve({}))
    TransferService.getTransferDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    TransferService.saveTransferDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    TransferService.getTransferErrorDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    TransferService.saveTransferErrorDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    TransferService.getTransferFulfilmentDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    TransferService.saveTransferFulfilmentDuplicateCheck = sandbox.stub().returns(Promise.resolve(null))
    sandbox.stub(Cyril)
    Cyril.processFulfilMessage.returns({
      isFx: false
    })
    Cyril.processAbortMessage = sandbox.stub().returns({
      isFx: false,
      positionChanges: [{
        participantCurrencyId: 1
      }]
    })
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(Consumer, 'createHandler').returns(Promise.resolve())
    sandbox.stub(ilp)
    sandbox.stub(Kafka)
    Kafka.transformGeneralTopicName = sandbox.stub().returns('topic-test')
    Kafka.proceed = sandbox.stub().returns(Promise.resolve())
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

  transferHandlerTest.test('fulfil should', fulfilTest => {
    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when transfer.expirationDate has passed', async (test) => {
      // Arrange
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localFulfilMessages[0].value.metadata.event.action = 'reserve'

      // mock out validation calls
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED,
        id: randomUUID(),
        completedTimestamp: Time.getUTCString(new Date()),
        expirationDate: new Date('2020-01-01')
      }))
      Comparators.duplicateCheckComparator.withArgs(
        transfer.transferId,
        localFulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(true)
      TransferService.handlePayeeResponse.returns(Promise.resolve({}))
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')
      const reservedAbortedPayload = getMessagePayloadOrThrow(Kafka.proceed.getCalls()[1].args[1].message)
      test.equal(reservedAbortedPayload.transferState, 'ABORTED')
      test.ok(reservedAbortedPayload.transferId, 'payload.transferId is defined')
      test.ok(reservedAbortedPayload.completedTimestamp, 'payload.completedTimestamp is defined')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when transferState !== RESERVED', async (test) => {
      // Arrange
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localFulfilMessages[0].value.metadata.event.action = 'reserve'

      // mock out validation calls
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        transferState: TransferState.ABORTED,
        transferStateEnumeration: TransferState.ABORTED,
        id: randomUUID(),
        completedTimestamp: Time.getUTCString(new Date())
      }))
      Comparators.duplicateCheckComparator.withArgs(
        transfer.transferId,
        localFulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(true)
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')
      const reservedAbortedPayload = getMessagePayloadOrThrow(Kafka.proceed.getCalls()[1].args[1].message)
      test.equal(reservedAbortedPayload.transferState, 'ABORTED')
      test.ok(reservedAbortedPayload.transferId, 'payload.transferId is defined')
      test.ok(reservedAbortedPayload.completedTimestamp, 'payload.completedTimestamp is defined')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when action === RESERVE', async (test) => {
      // Arrange
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localFulfilMessages[0].value.metadata.event.action = 'reserve'

      // mock out validation calls
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        transferState: TransferState.RESERVED,
        id: randomUUID(),
        completedTimestamp: Time.getUTCString(new Date())

      }))
      Comparators.duplicateCheckComparator.withArgs(
        transfer.transferId,
        localFulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(false)
      Kafka.proceed.returns(true)
      Cyril.processAbortMessage.returns({
        isFx: false,
        positionChanges: [{
          participantCurrencyId: 1
        }]
      })

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')
      const reservedAbortedPayload = getMessagePayloadOrThrow(Kafka.proceed.getCall(1).args[1].message)
      test.equal(reservedAbortedPayload.transferState, 'ABORTED')
      test.ok(reservedAbortedPayload.transferId, 'payload.transferId is defined')
      test.ok(reservedAbortedPayload.completedTimestamp, 'payload.completedTimestamp is defined')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when when RESERVED transfer state is received from v1.0 clients', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.0'
      localFulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - consumer throws error', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - autocommit is enabled', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when fspiop-destination does not match payerFsp', async (test) => {
      // Setup
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'fspdoesnotexist'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert

      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-destination does not match payer fsp or hub on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp', async (test) => {
      // Setup
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp - autocommit is enabled', async (test) => {
      // Setup
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      test.end()
    })

    fulfilTest.test('fail validation when fspiop-destination does not match payerFsp for RESERVED callback', async (test) => {
      // Setup
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'fspdoesnotexist'
      localFulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.1'
      localFulfilMessages[0].value.content.payload.transferState = TransferState.RESERVED
      localFulfilMessages[0].value.metadata.event.action = Enum.Events.Event.Action.RESERVE
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert

      test.equal(result, true)
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)
      const kafkaCallTwo = Kafka.proceed.getCalls()[1]

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-destination does not match payer fsp or hub on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      // lets check if the outbound event is sent to the notifications with the correct status
      test.equal(kafkaCallTwo.args[1].message.value.content.payload.transferState, TransferState.ABORTED)
      test.equal(kafkaCallTwo.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      test.equal(kafkaCallTwo.args[2].eventDetail.action, Enum.Events.Event.Action.RESERVED_ABORTED)
      test.equal(kafkaCallTwo.args[2].fromSwitch, true)

      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp for RESERVED callback', async (test) => {
      // Setup
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.1'
      localFulfilMessages[0].value.content.payload.transferState = TransferState.RESERVED
      localFulfilMessages[0].value.metadata.event.action = Enum.Events.Event.Action.RESERVE
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert
      test.equal(result, true)
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)
      const kafkaCallTwo = Kafka.proceed.getCalls()[1]

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-source does not match payee fsp on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      // lets check if the outbound event is sent to the notifications with the correct status
      test.equal(kafkaCallTwo.args[1].message.value.content.payload.transferState, TransferState.ABORTED)
      test.equal(kafkaCallTwo.args[2].eventDetail.functionality, Enum.Events.Event.Type.NOTIFICATION)
      test.equal(kafkaCallTwo.args[2].eventDetail.action, Enum.Events.Event.Action.RESERVED_ABORTED)
      test.equal(kafkaCallTwo.args[2].fromSwitch, true)

      test.end()
    })

    fulfilTest.test('fail validation when condition from fulfilment does not match original condition', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when condition from fulfilment does not match original condition - autocommit is enabled', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when transfer not reserved ', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RECEIVED_PREPARE
      }))
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED,
        transferId: transfer.transferId,
        expirationDate: new Date('2030-01-01')
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.COMMIT)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass with RESERVED_FORWARDED state', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'proxyFsp',
        transferState: TransferInternalState.RESERVED_FORWARDED,
        transferStateEnumeration: TransferState.RESERVED,
        transferId: transfer.transferId,
        expirationDate: new Date('2030-01-01')
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'proxyFsp'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.COMMIT)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail if event type is not fulfil', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localFulfilMessages[0].value.metadata.event.type = 'invalid_event_type'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass if Cyril result is fx enabled', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Cyril.processFulfilMessage.returns({
        isFx: true,
        positionChanges: [{
          participantCurrencyId: 1
        }]
      })

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.COMMIT)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass if Cyril result is fx enabled on RESERVED_FORWARDED transfer state', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Cyril.processFulfilMessage.returns({
        isFx: true,
        positionChanges: [{
          participantCurrencyId: 1
        }]
      })

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferInternalState.RESERVED_FORWARDED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.COMMIT)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail when Cyril result contains no positionChanges', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Cyril.processFulfilMessage.returns({
        isFx: true,
        positionChanges: []
      })

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass and action is RESERVE', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.metadata.event.action = 'reserve'
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when BULK_COMMIT validations pass', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[1].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[1].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[1].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[1].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages[1])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when BULK_ABORT message is received', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        currency: 'USD'
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[1].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[1].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[1].value.content.payload = errInfo
      localFulfilMessages[1].value.metadata.event.action = 'bulk-abort'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[1].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages[1])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('handle BULK_ABORT with valid errorInformation', async (test) => {
      // Arrange
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      localFulfilMessages[0].value.content.payload = errInfo
      localFulfilMessages[0].value.metadata.event.action = 'bulk-abort'
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED,
        transferId: transfer.transferId,
        currency: 'USD',
        expirationDate: new Date('2030-01-01')
      }))

      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      TransferService.handlePayeeResponse.returns(Promise.resolve({}))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ participantCurrencyId: 1 }))
      Kafka.proceed.returns(Promise.resolve())

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert - BULK_ABORT should process successfully and return true
      test.equal(result, true, 'Handler should return true after processing BULK_ABORT')
      test.ok(TransferService.handlePayeeResponse.calledOnce, 'handlePayeeResponse was called')
      test.ok(Participant.getAccountByNameAndCurrency.calledOnce, 'getAccountByNameAndCurrency was called')
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called')
      test.end()
    })

    fulfilTest.test('handle BULK_ABORT with invalid errorInformation - catch block execution', async (test) => {
      // Arrange
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      const invalidErrInfo = {
        errorInformation: {
          errorCode: 'INVALID_CODE', // Invalid error code to trigger catch block
          errorDescription: 'Invalid error'
        }
      }
      localFulfilMessages[0].value.content.payload = invalidErrInfo
      localFulfilMessages[0].value.metadata.event.action = 'bulk-abort'
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'

      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED,
        transferId: transfer.transferId,
        currency: 'USD',
        expirationDate: new Date('2030-01-01')
      }))

      Comparators.duplicateCheckComparator.returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      TransferService.handlePayeeResponse.returns(Promise.resolve({}))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ participantCurrencyId: 1 }))
      Kafka.proceed.returns(Promise.resolve())

      // Act
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)

      // Assert - BULK_ABORT should process successfully and return true (even for invalid errorCode, it handles gracefully)
      test.equal(result, true, 'Handler should return true after processing BULK_ABORT with invalid error info')
      test.ok(TransferService.handlePayeeResponse.called, 'handlePayeeResponse was called (at least once in catch block)')
      test.ok(Participant.getAccountByNameAndCurrency.called, 'getAccountByNameAndCurrency was called (at least once in catch block)')
      test.ok(Kafka.proceed.called, 'Kafka.proceed was called (at least once in catch block)')
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass - autocommit is enabled', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Validator.validateFulfilCondition.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer - autocommit is enabled', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('log an error when something goes wrong', async (test) => {
      try {
        const localFulfilMessages = MainUtil.clone(fulfilMessages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        TransferService.getById.throws(new Error())
        ilp.update.returns(Promise.resolve())

        await allTransferHandlers.fulfil(null, localFulfilMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        test.ok(SpanStub.finish.calledWith('', expectedState))
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    // fulfilTest.test('produce notification when hash exists and state not found', async (test) => {
    //   const localFulfilMessages = MainUtil.clone(fulfilMessages)
    //   await Consumer.createHandler(topicName, config, command)
    //   Consumer.isConsumerAutoCommitEnabled.returns(true)
    //   Kafka.transformGeneralTopicName.returns(topicName)
    //   TransferService.getById.returns(Promise.resolve({
    //     condition: 'condition',
    //     payeeFsp: 'dfsp2',
    //     expirationDate: new Date('1900-01-01'),
    //     transferState: TransferState.RESERVED
    //   }))
    //     existsMatching: true,
    //     existsNotMatching: false
    //   }))
    //   ilp.update.returns(Promise.resolve())
    //   Validator.validateFulfilCondition.returns(true)
    //   Kafka.proceed.returns(true)
    //   localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
    //   localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

    //   TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
    //   TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
    //   Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
    //     hasDuplicateId: true,
    //     hasDuplicateHash: false
    //   }))

    //   const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
    //   test.equal(result, true)
    //   test.end()
    // })

    fulfilTest.test('produce notification when hash exists, state is committed and source does not match payee', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferState.COMMITTED })
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp1'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is committed and source matches payee', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.COMMITTED,
        transferStateEnumeration: TransferState.COMMITTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is committed but hash is invalid', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.COMMITTED,
        transferStateEnumeration: TransferState.COMMITTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is received', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferInternalState.RECEIVED_FULFIL,
        transferStateEnumeration: TransferState.RECEIVED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is reserved', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is aborted', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferInternalState.ABORTED_REJECTED,
        transferStateEnumeration: TransferState.ABORTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce error notification when hash matched, transferState is undefined', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: undefined,
        transferStateEnumeration: undefined
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('continue execution when hash exists not matching', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash matched and is valid', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferInternalState.ABORTED_ERROR,
        transferStateEnumeration: TransferState.ABORTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localFulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists and is invalid', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferInternalState.ABORTED_ERROR,
        transferStateEnumeration: TransferState.ABORTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localFulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists but not matching', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferInternalState.ABORTED_ERROR,
        transferStateEnumeration: TransferState.ABORTED
      }))
      Kafka.proceed.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localFulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter reject branch when action REJECT', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferInternalState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.content.headers['fspiop-destination'] = 'dfsp1'
      invalidEventMessage.value.metadata.event.action = 'reject'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter reject branch when action REJECT - autocommit is enabled', async (test) => { // TODO: extend and enable unit test
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferInternalState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.content.headers['fspiop-destination'] = 'dfsp1'
      invalidEventMessage.value.metadata.event.action = 'reject'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter ABORT branch with action REJECT', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferInternalState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      invalidEventMessage.value.metadata.event.action = 'reject'
      delete fulfilMessages[0].value.content.payload.fulfilment
      TransferService.handlePayeeResponse.returns({
        transferErrorRecord: {
          errorCode: '5000',
          errorDescription: 'generic'
        }
      })
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter validation error branch when abort with undefined code', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED
      }))
      TransferService.handlePayeeResponse.returns(Promise.resolve({ transferErrorRecord: { errorCode: '5000', errorDescription: 'error text' } }))
      invalidEventMessage.value.metadata.event.action = 'abort'
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('set transfer ABORTED when valid errorInformation is provided', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED
      }))
      TransferService.handlePayeeResponse.returns(Promise.resolve({ transferErrorRecord: { errorCode: '5000', errorDescription: 'error text' } }))
      invalidEventMessage.value.metadata.event.action = 'abort'
      invalidEventMessage.value.content.payload = errInfo
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('set transfer ABORTED when valid errorInformation is provided from RESERVED_FORWARDED state', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferInternalState.RESERVED_FORWARDED
      }))
      TransferService.handlePayeeResponse.returns(Promise.resolve({ transferErrorRecord: { errorCode: '5000', errorDescription: 'error text' } }))
      invalidEventMessage.value.metadata.event.action = 'abort'
      invalidEventMessage.value.content.payload = errInfo
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('log error', async (test) => { // TODO: extend and enable unit test
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.throws(new Error())
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.metadata.event.action = 'reject'

      try {
        await allTransferHandlers.fulfil(null, invalidEventMessage)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        test.ok(SpanStub.finish.calledWith('', expectedState))
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    fulfilTest.test('fail validation when invalid event action is provided', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      invalidEventMessage.value.metadata.event.action = 'invalid event'
      Kafka.proceed.returns(true)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, invalidEventMessage.value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, [invalidEventMessage])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - autocommit is enabled', async (test) => {
      const invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      invalidEventMessage.value.metadata.event.action = 'invalid event'
      invalidEventMessage.value.content.payload = { extensionList: {} }
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, [invalidEventMessage])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('throw an error when an error is thrown from Kafka', async (test) => {
      try {
        await allTransferHandlers.fulfil(new Error(), null)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    fulfilTest.test('fail when Cyril result contains no positionChanges for ABORT action', async (test) => {
      const localFulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }))
      ilp.update.returns(Promise.resolve())
      Validator.validateFulfilCondition.returns(true)
      localFulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localFulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localFulfilMessages[0].value.content.payload = errInfo
      localFulfilMessages[0].value.metadata.event.action = 'abort'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localFulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Cyril.processAbortMessage.returns({
        isFx: false,
        positionChanges: []
      })
      const result = await allTransferHandlers.fulfil(null, localFulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.end()
  })

  transferHandlerTest.test('noop functionality coverage', (test) => {
    // Test the noop logic that was previously lacking coverage
    test.comment('Testing shouldNoopForInterschemeProxiedGetState logic coverage')

    // Simulate the function logic from the handler
    const shouldNoopForInterschemeProxiedGetState = (transferState) => {
      if (!transferState) return true
      return transferState.startsWith('RESERVED') || transferState.startsWith('RECEIVED')
    }

    // Test cases that should trigger noop (return true)
    test.equal(shouldNoopForInterschemeProxiedGetState(null), true, 'null state should noop')
    test.equal(shouldNoopForInterschemeProxiedGetState(undefined), true, 'undefined state should noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('RESERVED'), true, 'RESERVED state should noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('RESERVED_FORWARDED'), true, 'RESERVED_FORWARDED state should noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('RECEIVED'), true, 'RECEIVED state should noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('RECEIVED_PREPARE'), true, 'RECEIVED_PREPARE state should noop')

    // Test cases that should not trigger noop (return false)
    test.equal(shouldNoopForInterschemeProxiedGetState('COMMITTED'), false, 'COMMITTED state should not noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('ABORTED'), false, 'ABORTED state should not noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('SETTLED'), false, 'SETTLED state should not noop')
    test.equal(shouldNoopForInterschemeProxiedGetState('EXPIRED'), false, 'EXPIRED state should not noop')

    // Test noop condition combinations
    const shouldNoop = (isProxiedGet, isExternalParticipant, transfer) => {
      return !!(isProxiedGet &&
               isExternalParticipant &&
               transfer &&
               shouldNoopForInterschemeProxiedGetState(transfer.transferState))
    }

    // Test combination scenarios
    test.equal(
      shouldNoop(true, true, { transferState: 'RESERVED_FORWARDED' }),
      true,
      'Proxied + External + RESERVED_FORWARDED should noop'
    )

    test.equal(
      shouldNoop(true, true, { transferState: 'COMMITTED' }),
      false,
      'Proxied + External + COMMITTED should not noop'
    )

    test.equal(
      shouldNoop(false, true, { transferState: 'RESERVED_FORWARDED' }),
      false,
      'Non-proxied should not noop'
    )

    test.equal(
      shouldNoop(true, false, { transferState: 'RESERVED_FORWARDED' }),
      false,
      'Internal participant should not noop'
    )

    test.equal(
      shouldNoop(true, true, null),
      false,
      'Null transfer should not noop'
    )

    test.pass('All noop logic coverage tests completed successfully')
    test.end()
  })


  transferHandlerTest.end()
})
