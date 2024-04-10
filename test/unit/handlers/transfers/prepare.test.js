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
const ilp = require('../../../../src/models/transfer/ilpPacket')
const { randomUUID } = require('crypto')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const EventSdk = require('@mojaloop/event-sdk')
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Proxyquire = require('proxyquire')
const Participant = require('../../../../src/domain/participant')
const Config = require('../../../../src/lib/config')
const { Action } = Enum.Events.Event

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

const configAutocommit = {
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
    'enable.auto.commit': true
  }
}

const command = () => {
}

const error = () => {
  throw new Error()
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

  transferHandlerTest.test('prepare should', prepareTest => {
    prepareTest.test('persist transfer to database when messages is an array', async (test) => {
      const localMessages = MainUtil.clone(messages)
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '0')
      test.equal(kafkaCallOne.args[2].topicNameOverride, null)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('use topic name override if specified in config', async (test) => {
      Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE = 'topic-test-override'
      const localMessages = MainUtil.clone(messages)
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '0')
      test.equal(kafkaCallOne.args[2].topicNameOverride, 'topic-test-override')
      test.equal(result, true)
      delete Config.KAFKA_CONFIG.EVENT_TYPE_ACTION_TOPIC_MAP.POSITION.PREPARE
      test.end()
    })

    prepareTest.test('persist transfer to database when messages is an array - consumer throws error', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.transformAccountToTopicName.returns(topicName)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      const kafkaCallOne = Kafka.proceed.getCall(0)
      test.equal(kafkaCallOne.args[2].eventDetail.functionality, Enum.Events.Event.Type.POSITION)
      test.equal(kafkaCallOne.args[2].eventDetail.action, Enum.Events.Event.Action.PREPARE)
      test.equal(kafkaCallOne.args[2].messageKey, '0')
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - autocommit is enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.getByIdLight.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve(null))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is COMMITTED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(Promise.resolve(transferReturn))
      TransferObjectTransform.toTransfer.withArgs(transferReturn).returns(transfer)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is ABORTED_REJECTED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'ABORTED' }))
      TransferService.getById.withArgs(transfer.transferId).returns(Promise.resolve(transferReturn))

      TransferObjectTransform.toFulfil.withArgs(transferReturn).returns(fulfil)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'RECEIVED' }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'unknown' }))
      localMessages[0].value.metadata.event.action = 'unknown'

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RESERVED', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(Promise.resolve({ enumeration: 'RESERVED' }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: true
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: true,
        hasDuplicateHash: false
      }))

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when BULK_PREPARE single message sent', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[1])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent - autocommit is enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      MainUtil.StreamingProtocol.createEventState.returns(messageProtocol.metadata.event.state)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(Promise.resolve(null))
      TransferService.prepare.returns(Promise.resolve(true))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError -kafka autocommit enabled', async (test) => {
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      MainUtil.StreamingProtocol.createEventState.returns(messageProtocol.metadata.event.state)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.returns(Promise.resolve(true))

      const result = await allTransferHandlers.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare - kafka autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Validator.validatePrepare.returns({ validationPassed: false, reasons: [] })
      TransferService.prepare.throws(new Error())
      TransferService.getTransferDuplicateCheck.returns(Promise.resolve(null))
      TransferService.saveTransferDuplicateCheck.returns(Promise.resolve(null))
      Comparators.duplicateCheckComparator.withArgs(transfer.transferId, transfer).returns(Promise.resolve({
        hasDuplicateId: false,
        hasDuplicateHash: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('log an error when consumer not found', async (test) => {
      try {
        const localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns('invalid-topic')
        await allTransferHandlers.prepare(null, localMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        const args = SpanStub.finish.getCall(0).args
        test.ok(args[0].length > 0)
        test.deepEqual(args[1], expectedState)
        test.end()
      } catch (e) {
        test.fail('Error Thrown')
        test.end()
      }
    })

    prepareTest.test('throw an error when an error is thrown from Kafka', async (test) => {
      try {
        await allTransferHandlers.prepare(error, null)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    prepareTest.end()
  })

  transferHandlerTest.test('processDuplication', processDuplicationTest => {
    processDuplicationTest.test('return undefined hasDuplicateId is falsey', async (test) => {
      const result = await prepare.processDuplication({
        duplication: {
          hasDuplicateId: false
        }
      })
      test.equal(result, undefined)
      test.end()
    })

    processDuplicationTest.test('throw error if action is BULK_PREPARE', async (test) => {
      try {
        await prepare.processDuplication({
          duplication: {
            hasDuplicateId: true,
            hasDuplicateHash: true
          },
          location: { module: 'PrepareHandler', method: '', path: '' },
          action: Action.BULK_PREPARE
        })
        test.fail('Error not thrown')
      } catch (e) {
        test.pass('Error thrown')
      }
      test.end()
    })
    processDuplicationTest.end()
  })
  transferHandlerTest.end()
})
