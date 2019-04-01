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
const P = require('bluebird')
const allTransferHandlers = require('../../../../src/handlers/transfers/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const FiveBellsCondition = require('five-bells-condition')
const MainUtil = require('../../../../src/lib/util')
const Util = require('../../../../src/handlers/lib/utility')
const ilp = require('../../../../src/models/transfer/ilpPacket')
const Uuid = require('uuid4')
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('../../../../src/handlers/lib/kafka/consumer')
const DAO = require('../../../../src/handlers/lib/dao')
const Enum = require('../../../../src/lib/enum')
const TransferState = Enum.TransferState
const TransferStateEnum = Enum.TransferStateEnum

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
  id: transfer.transferId,
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp },
    payload: transfer
  },
  metadata: {
    event: {
      id: Uuid(),
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

const topicName = 'topic-test'

const messages = [
  {
    topic: topicName,
    value: messageProtocol
  }
]

const fulfilMessages = [
  {
    topic: topicName,
    value: Object.assign({}, messageProtocol, {
      content: {
        payload: fulfil,
        headers: {
          'fspiop-source': 'dfsp1',
          'fspiop-destination': 'dfsp2'
        }
      },
      metadata: {
        event: {
          type: 'fulfil',
          action: 'commit'
        }
      }
    })
  }
]

const config = {
  options: {
    'mode': 2,
    'batchSize': 1,
    'pollFrequency': 10,
    'recursiveTimeout': 100,
    'messageCharset': 'utf8',
    'messageAsJSON': true,
    'sync': true,
    'consumeTimeout': 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    'debug': 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  }
}

const configAutocommit = {
  options: {
    'mode': 2,
    'batchSize': 1,
    'pollFrequency': 10,
    'recursiveTimeout': 100,
    'messageCharset': 'utf8',
    'messageAsJSON': true,
    'sync': true,
    'consumeTimeout': 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    'debug': 'all',
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

const participants = ['testName1', 'testName2']

Test('Transfer handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(DAO)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(P.resolve())
    sandbox.stub(Validator)
    sandbox.stub(TransferService)
    sandbox.stub(Kafka.Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Kafka.Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(ilp)
    sandbox.stub(Util)
    sandbox.stub(TransferObjectTransform, 'toTransfer')
    sandbox.stub(TransferObjectTransform, 'toFulfil')
    Util.produceGeneralMessage.returns(P.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('prepare should', prepareTest => {
    prepareTest.test('persist transfer to database when messages is an array', async (test) => {
      let localMessages = MainUtil.clone(messages)
      // here copy
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when messages is an array - consumer throws error', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.throws(new Error())
      Util.transformAccountToTopicName.returns(topicName)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve(null))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - autocommit is enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve(null))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found but without transferState - kafka autocommit enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve(null))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is COMMITTED', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve({ enumeration: 'COMMITTED' }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      TransferService.getById.withArgs(transfer.transferId).returns(P.resolve(transferReturn))
      TransferObjectTransform.toTransfer.withArgs(transferReturn).returns(transfer)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate found and transferState is ABORTED_REJECTED', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve({ enumeration: 'ABORTED' }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      TransferService.getById.withArgs(transfer.transferId).returns(P.resolve(transferReturn))

      TransferObjectTransform.toFulfil.withArgs(transferReturn).returns(fulfil)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve({ enumeration: 'RECEIVED' }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RECEIVED', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve({ enumeration: 'unknown' }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      localMessages[0].value.metadata.event.action = 'unknown'

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('do nothing when duplicate found and transferState is RESERVED', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      TransferService.getTransferStateChange.withArgs(transfer.transferId).returns(P.resolve({ enumeration: 'RESERVED' }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: true
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send callback when duplicate transfer id found but hash doesnt match - kafka autocommit enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: true
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)

      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent - autocommit is enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('persist transfer to database when single message sent -kafka autocommit enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.throws(new Error())
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation successful but duplicate error thrown by prepare -kafka autocommit enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: true, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.throws(new Error())
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createState.returns(messageProtocol.metadata.event.state)
      Validator.validateByName.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('fail validation and persist INVALID transfer to database and insert transferError -kafka autocommit enabled', async (test) => {
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createState.returns(messageProtocol.metadata.event.state)
      Validator.validateByName.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.returns(P.resolve(true))

      const result = await allTransferHandlers.prepare(null, messages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.throws(new Error())
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('send notification when validation failed and duplicate error thrown by prepare -kafka autocommit enabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, configAutocommit, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Validator.validateByName.returns({ validationPassed: false, reasons: [] })
      TransferService.getById.returns(P.resolve(null))
      TransferService.prepare.throws(new Error())
      TransferService.validateDuplicateHash.withArgs(transfer.transferId, transfer).returns(P.resolve({
        existsMatching: false,
        existsNotMatching: false
      }))
      Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
      const result = await allTransferHandlers.prepare(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    prepareTest.test('throw an error when an error is thrown by prepare', async (test) => {
      try {
        let localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Util.transformAccountToTopicName.returns(topicName)
        Util.proceed.returns(true)
        Util.createPrepareErrorStatus.returns(messageProtocol.content.payload)
        Util.createState.returns(messageProtocol.metadata.event.state)
        Validator.validateByName.returns({ validationPassed: true, reasons: [] })
        TransferService.getById.returns(P.resolve(null))
        TransferService.prepare.throws(new Error())
        await allTransferHandlers.prepare(null, localMessages)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    prepareTest.test('throw an error when consumer not found', async (test) => {
      try {
        let localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Util.transformAccountToTopicName.returns('invalid-topic')
        await allTransferHandlers.prepare(null, localMessages)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
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

  transferHandlerTest.test('register getTransferHandler should', registerTransferhandler => {
    registerTransferhandler.test('return a true when registering the transfer handler', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerGetTransferHandler(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    registerTransferhandler.test('return an error when registering the transfer handler.', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())
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
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.getTransfer(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return true on an array of messages', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when an error is passed in', async (test) => {
      try {
        let localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.returns(config)
        await allTransferHandlers.getTransfer(true, localMessages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    transformTransfer.test('return an error when the Kafka topic is invalid', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.throws(new Error())
      Util.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is not found', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.returns(null)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is not found', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.returns(null)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(false)
      TransferService.getByIdLight.returns({})
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the requester is not involved in the transfer - autocommit disabled', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(false)
      TransferService.getByIdLight.returns({})
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(false)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when the transfer by id is found', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(P.resolve(transferReturn))
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allTransferHandlers.getTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    transformTransfer.test('return an error when general message cannot be produced', async (test) => {
      let localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Util.proceed.throws(new Error())
      Validator.validateParticipantByName.returns(true)
      Validator.validateParticipantTransferId.returns(true)
      let transferResult = MainUtil.clone(transferReturn)
      transferReturn.transferState = 'ABORTED_REJECTED'
      transferResult.extensionList = []
      TransferService.getByIdLight.withArgs(transfer.transferId).returns(P.resolve(transferResult))

      try {
        await allTransferHandlers.getTransfer(null, localMessages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    transformTransfer.end()
  })

  transferHandlerTest.test('fulfil should', fulfilTest => {
    fulfilTest.test('fail validation when invalid event action is provided', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve(null))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - consumer throws error', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.getConsumer.throws(new Error())
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve(null))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve(null))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ payeeFsp: 'dfsp2' }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp1'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when fspiop-source does not match payeeFsp - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ payeeFsp: 'dfsp2' }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp1'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when condition from fulfilment does not match original condition', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2' }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when condition from fulfilment does not match original condition - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2' }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'fulfilment'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when transfer already committed ', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2', transferState: TransferState.COMMITTED }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when transfer already committed - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2', transferState: TransferState.COMMITTED }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when transfer not reserved ', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2', transferState: TransferState.RECEIVED_PREPARE }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2', transferState: TransferState.RESERVED }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce message to position topic when validations pass - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Validator.validateFulfilCondition.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({ condition: 'condition', payeeFsp: 'dfsp2', transferState: TransferState.RESERVED }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      ilp.update.returns(P.resolve())
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('expired transfer - autocommit is enabled', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('throw an error when something goes wrong', async (test) => {
      try {
        let localfulfilMessages = MainUtil.clone(fulfilMessages)
        await Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        TransferService.getById.throws(new Error())
        FiveBellsCondition.fulfillmentToCondition.returns('condition')
        ilp.update.returns(P.resolve())
        Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)

        await allTransferHandlers.fulfil(null, localfulfilMessages)
        test.fail('No Error Thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    fulfilTest.test('produce notification when hash exists and state not found', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false
      }))
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is committed and source does not match payee', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.COMMITTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp1'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is committed and source matches payee', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.COMMITTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is committed but hash is invalid', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: false
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.COMMITTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is received', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.RECEIVED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is reserved', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.RESERVED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification when hash exists, state is aborted', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.RECEIVED_PREPARE })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('continue execution when hash exists not matching', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: false,
        existsNotMatching: true,
        isValid: true
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.RESERVED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists and is valid', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: true,
        transferErrorDuplicateCheckId: 1
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.ABORTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists and is invalid', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: true,
        existsNotMatching: false,
        isValid: false,
        transferErrorDuplicateCheckId: 1
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.ABORTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('produce notification for abort when hash exists but not matching', async (test) => {
      let localfulfilMessages = MainUtil.clone(fulfilMessages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        expirationDate: new Date('1900-01-01'),
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({
        existsMatching: false,
        existsNotMatching: true,
        isValid: false,
        transferErrorDuplicateCheckId: 1
      }))
      TransferService.getTransferStateChange.returns({ enumeration: TransferStateEnum.ABORTED })
      ilp.update.returns(P.resolve())
      Validator.validateFulfilCondition.returns(true)
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      Util.proceed.returns(true)
      localfulfilMessages[0].value.content.headers['fspiop-source'] = 'dfsp2'
      localfulfilMessages[0].value.content.payload.fulfilment = 'condition'
      localfulfilMessages[0].value.metadata.event.action = 'abort'

      const result = await allTransferHandlers.fulfil(null, localfulfilMessages)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter reject branch when action REJECT', async (test) => {
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.metadata.event.action = 'reject'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter reject branch when action REJECT - autocommit is enabled', async (test) => { // TODO: extend and enable unit test
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.metadata.event.action = 'reject'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter ABORT branch with action REJECT', async (test) => {
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      invalidEventMessage.value.metadata.event.action = 'reject'
      delete fulfilMessages[0].value.content.payload.fulfilment
      TransferService.abort.returns({
        transferErrorRecord: {
          errorCode: 5000,
          errorDescription: 'generic'
        }
      })
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('enter ABORT branch when action ABORT', async (test) => {
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      Validator.validateFulfilCondition.returns(true)
      TransferService.getById.returns(P.resolve({
        condition: 'condition',
        payeeFsp: 'dfsp2',
        transferState: TransferState.RESERVED
      }))
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      TransferService.abort.returns(P.resolve({ transferErrorRecord: { errorCode: '5000', errorDescription: 'error text' } }))
      Util.createPrepareErrorStatus.returns(fulfilMessages[0].value.content.payload)
      invalidEventMessage.value.metadata.event.action = 'abort'
      delete fulfilMessages[0].value.content.payload.fulfilment
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, invalidEventMessage)
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('throw error', async (test) => { // TODO: extend and enable unit test
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.getById.throws(new Error())
      invalidEventMessage.value.content.headers['fspiop-source'] = 'dfsp2'
      invalidEventMessage.value.metadata.event.action = 'reject'

      try {
        await allTransferHandlers.fulfil(null, invalidEventMessage)
        test.fail('should throw error')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    fulfilTest.test('fail validation when invalid event action is provided', async (test) => {
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      invalidEventMessage.value.metadata.event.action = 'invalid event'
      Util.proceed.returns(true)

      const result = await allTransferHandlers.fulfil(null, [invalidEventMessage])
      test.equal(result, true)
      test.end()
    })

    fulfilTest.test('fail validation when invalid event action is provided - autocommit is enabled', async (test) => {
      let invalidEventMessage = MainUtil.clone(fulfilMessages)[0]
      await Consumer.createHandler(topicName, config, command)
      Kafka.Consumer.isConsumerAutoCommitEnabled.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      TransferService.validateDuplicateHash.returns(P.resolve({}))
      invalidEventMessage.value.metadata.event.action = 'invalid event'
      invalidEventMessage.value.content.payload = { extensionList: {} }
      Util.proceed.returns(true)

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
      await Kafka.Consumer.createHandler(topicName, config, command)
      DAO.retrieveAllParticipants.returns(P.resolve(participants))
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      Util.getKafkaConfig.returns(config)

      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('register a consumer on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Util.transformAccountToTopicName.returns(topicName)
      Util.proceed.returns(true)
      Util.transformGeneralTopicName.returns(topicName)
      Util.getKafkaConfig.returns(config)
      await DAO.retrieveAllParticipants.returns(P.resolve(participants))

      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('throw error retrieveAllParticipants', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        await DAO.retrieveAllParticipants.returns(P.resolve(participants))
        Util.transformAccountToTopicName.returns(topicName)
        Util.proceed.returns(true)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())

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
        await Kafka.Consumer.createHandler(topicName, config, command)
        await DAO.retrieveAllParticipants.returns(P.resolve([]))
        Util.transformAccountToTopicName.returns(topicName)
        Util.proceed.returns(true)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())

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
        await Kafka.Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())

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
        await Kafka.Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())

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
        await Kafka.Consumer.createHandler(topicName, config, command)
        Util.transformGeneralTopicName.returns(topicName)
        Util.getKafkaConfig.throws(new Error())

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
