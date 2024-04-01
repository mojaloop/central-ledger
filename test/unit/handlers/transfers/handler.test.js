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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const Cyril = require('../../../../src/domain/fx/cyril')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const MainUtil = require('@mojaloop/central-services-shared').Util
const Time = require('@mojaloop/central-services-shared').Util.Time
const ilp = require('../../../../src/models/transfer/ilpPacket')
const { randomUUID } = require('crypto')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')
const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Proxyquire = require('proxyquire')
const { getMessagePayloadOrThrow } = require('../../../util/helpers')
const Participant = require('../../../../src/domain/participant')

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

const messageProtocolBulkPrepare = MainUtil.clone(messageProtocol)
messageProtocolBulkPrepare.metadata.event.action = 'bulk-prepare'
const messageProtocolBulkCommit = MainUtil.clone(messageProtocol)
messageProtocolBulkCommit.metadata.event.action = 'bulk-commit'

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
    SpanStub = {
      audit: sandbox.stub().callsFake(),
      error: sandbox.stub().callsFake(),
      finish: sandbox.stub().callsFake(),
      debug: sandbox.stub().callsFake(),
      info: sandbox.stub().callsFake(),
      getChild: sandbox.stub().returns(SpanStub),
      setTags: sandbox.stub().callsFake()
    }

    const TracerStub = {
      extractContextFromMessage: sandbox.stub().callsFake(() => {
        return {}
      }),
      createChildSpanFromContext: sandbox.stub().callsFake(() => {
        return SpanStub
      })
    }

    const EventSdkStub = {
      Tracer: TracerStub
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
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.returns(null)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is not found', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.returns(null)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(false)
      TransferService.getByIdLight.returns({})
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer - autocommit disabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(false)
      TransferService.getByIdLight.returns({})
      Consumer.isConsumerAutoCommitEnabled.returns(false)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is found', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferReturn))
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('log an error when the transfer state is EXPIRED_RESERVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.proceed.returns(Promise.resolve(true))
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      const transferResult = MainUtil.clone(transferReturn)
      transferResult.transferState = 'EXPIRED_RESERVED'
      transferResult.extensionList = []
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferResult))

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
      transferReturn.transferState = 'ABORTED_REJECTED'
      transferResult.extensionList = []
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferResult))

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

    transformTransfer.end()
  })

  transferHandlerTest.test('fulfil should', fulfilTest => {
    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when transfer.expirationDate has passed', async (test) => {
      // Arrange
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      localfulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localfulfilMessages[0].value.metadata.event.action = 'reserve'

      // mock out validation calls
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        transferState: TransferState.RESERVED,
        id: randomUUID(),
        completedTimestamp: Time.getUTCString(new Date()),
        expirationDate: new Date('2020-01-01')
      }))
      Comparators.duplicateCheckComparator.withArgs(
        transfer.transferId,
        localfulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(true)
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

      // Assert
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')
      const reservedAbortedPayload = getMessagePayloadOrThrow(Kafka.proceed.getCall(1).args[1].message)
      test.equal(reservedAbortedPayload.transferState, 'ABORTED')
      test.ok(reservedAbortedPayload.transferId, 'payload.transferId is defined')
      test.ok(reservedAbortedPayload.completedTimestamp, 'payload.completedTimestamp is defined')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when transferState !== RESERVED', async (test) => {
      // Arrange
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      localfulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localfulfilMessages[0].value.metadata.event.action = 'reserve'

      // mock out validation calls
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        transferState: TransferState.ABORTED,
        id: randomUUID(),
        completedTimestamp: Time.getUTCString(new Date())

      }))
      Comparators.duplicateCheckComparator.withArgs(
        transfer.transferId,
        localfulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(true)
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

      // Assert
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')
      const reservedAbortedPayload = getMessagePayloadOrThrow(Kafka.proceed.getCall(1).args[1].message)
      test.equal(reservedAbortedPayload.transferState, 'ABORTED')
      test.ok(reservedAbortedPayload.transferId, 'payload.transferId is defined')
      test.ok(reservedAbortedPayload.completedTimestamp, 'payload.completedTimestamp is defined')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('emit a RESERVED_ABORTED if validation fails when action === RESERVE', async (test) => {
      // Arrange
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      localfulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      localfulfilMessages[0].value.metadata.event.action = 'reserve'

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
        localfulfilMessages[0].value.content.payload
      ).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      Validator.validateFulfilCondition.returns(false)
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

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
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      localfulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.0'
      localfulfilMessages[0].value.content.payload.transferState = 'RESERVED'
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - consumer throws error', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - autocommit is enabled', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve(null))
      Kafka.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when fspiop-destination does not match payerFsp', async (test) => {
      // Setup
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'fspdoesnotexist'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

      // Assert

      test.equal(result, true)
      test.ok(Kafka.proceed.calledOnce, 'Kafka.proceed was called once')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-destination does not match payer fsp on the Fulfil callback response')
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.ABORT_VALIDATION)
      test.equal(kafkaCallOne.args[2].fromSwitch, true)
      test.equal(kafkaCallOne.args[2].messageKey, '0')

      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp', async (test) => {
      // Setup
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

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
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

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
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'fspdoesnotexist'
      localfulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.1'
      localfulfilMessages[0].value.content.payload.transferState = TransferState.RESERVED
      localfulfilMessages[0].value.metadata.event.action = Enum.Events.Event.Action.RESERVE
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

      // Assert

      test.equal(result, true)
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)
      const kafkaCallTwo = Kafka.proceed.getCall(1)

      // lets check if the first kafka proceed message contains an applicable error
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorCode, '3100')
      test.equal(kafkaCallOne.args[2].fspiopError.errorInformation.errorDescription, 'Generic validation error - fspiop-destination does not match payer fsp on the Fulfil callback response')
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
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'fspdoesnotexist'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.headers['content-type'] = 'application/vnd.interoperability.transfers+json;version=1.1'
      localfulfilMessages[0].value.content.payload.transferState = TransferState.RESERVED
      localfulfilMessages[0].value.metadata.event.action = Enum.Events.Event.Action.RESERVE
      Kafka.proceed.returns(true)

      // Act
      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)

      // Assert
      test.equal(result, true)
      test.ok(Kafka.proceed.calledTwice, 'Kafka.proceed was called twice')

      // fetch kafka proceed arguments
      const kafkaCallOne = Kafka.proceed.getCall(0)
      const kafkaCallTwo = Kafka.proceed.getCall(1)

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
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when condition from fulfilment does not match original condition - autocommit is enabled', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1'
      }))
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when transfer not reserved ', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(Promise.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        payerFsp: 'dfsp1',
        transferState: TransferState.RECEIVED_PREPARE
      }))
      Validator.validateFulfilCondition.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)

      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.COMMIT)
      test.equal(kafkaCallOne.args[2].messageKey, '1')
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass and action is RESERVE', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
      localfulfilMessages[0].value.metadata.event.action = 'reserve'
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when BULK_COMMIT validations pass', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[1].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[1].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[1].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[1].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages[1])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when BULK_ABORT message is received', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[1].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[1].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[1].value.content.payload = errInfo
      localfulfilMessages[1].value.metadata.event.action = 'bulk-abort'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[1].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages[1])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass - autocommit is enabled', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Kafka.proceed.returns(true)

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer - autocommit is enabled', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('log an error when something goes wrong', async (test) => {
      try {
        const localfulfilMessages = MainUtil.clone(fulfilMessages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        TransferService.getById.throws(new Error())
        ilp.update.returns(Promise.resolve())

        await allTransferHandlers.fulfil(null, localfulfilMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        test.ok(SpanStub.finish.calledWith('', expectedState))
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    // fulfilTest.test('produce notification when hash exists and state not found', async (test) => {
    //   const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
    //   localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
    //   localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

    //   TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
    //   TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
    //   Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
    //     hasDuplicateId: true,
    //     hasDuplicateHash: false
    //   }))

    //   const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
    //   test.equal(result, true)
    //   test.end()
    // })

    fulfilTest.test('produce notification when hash exists, state is committed and source does not match payee', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp1'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is committed and source matches payee', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is committed but hash is invalid', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is received', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is reserved', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash matched, state is aborted', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce error notification when hash matched, transferState is undefined', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('continue execution when hash exists not matching', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash matched and is valid', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists and is invalid', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists but not matching', async (test) => {
      const localfulfilMessages = MainUtil.clone(fulfilMessages)
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
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.headers['fspiop-destination'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, localfulfilMessages[0].value.content.payload).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
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

    fulfilTest.end()
  })

  transferHandlerTest.test('reject should', rejectTest => {
    rejectTest.test('throw', async (test) => {
      try {
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
