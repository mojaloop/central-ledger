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

 * Steven Oderayi <steven.oderayi@modusbox.com>
 --------------
 ******/
'use strict'

const Uuid = require('uuid4')
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')
const Test = require('tapes')(require('tape'))
const EventSdk = require('@mojaloop/event-sdk')
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const MainUtil = require('@mojaloop/central-services-shared').Util
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const Validator = require('../../../../../src/handlers/bulk/shared/validator')
const BulkTransferService = require('../../../../../src/domain/bulkTransfer')
const BulkTransferModel = require('../../../../../src/models/bulkTransfer/bulkTransfer')
const ilp = require('../../../../../src/models/transfer/ilpPacket')
// const TransferState = Enum.Transfers.TransferState
// const TransferInternalState = Enum.Transfers.TransferInternalState

const bulkTransfer = {
  bulkTransferId: 'fake-bulk-transfer-id',
  bulkQuoteId: 'fake-bulk-quote-id',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  expiration: '2016-05-24T08:38:08.699-04:00',
  individualTransfers: [
    {
      transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
      transferAmount: {
        currency: 'USD',
        amount: '433.88'
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'
    }
  ],
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

const bulkTransferReturn = {
  bulkTransferId: bulkTransfer.bulkTransferId,
  bulkTransferStateId: 'COMPLETED',
  completedTimestamp: new Date().toISOString(),
  payerFsp: 'payerfsp',
  payeeFsp: 'payeefsp',
  bulkQuoteId: bulkTransfer.bulkQuoteId,
  expirationDate: new Date().toISOString()
}

const messageProtocol = {
  id: Uuid(),
  from: bulkTransfer.payerFsp,
  to: bulkTransfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: {
      'fspiop-source': bulkTransfer.payeeFsp,
      'fspiop-destination': 'source'
    },
    uriParams: { id: bulkTransfer.bulkTransferId }
  },
  metadata: {
    event: {
      id: Uuid(),
      type: Enum.Events.Event.Type.BULK,
      action: Enum.Events.Event.Action.GET,
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

const command = () => { }

let SpanStub
let allBulkTransferHandlers

Test('Bulk Transfer GET handler', getHandlerTest => {
  let sandbox

  getHandlerTest.beforeEach(test => {
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

    allBulkTransferHandlers = Proxyquire('../../../../../src/handlers/bulk/get/handler', {
      '@mojaloop/event-sdk': EventSdkStub
    })

    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.stub(Comparators)
    sandbox.stub(Validator)
    sandbox.stub(BulkTransferService)
    sandbox.stub(BulkTransferModel)
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(ilp)
    sandbox.stub(Kafka)
    sandbox.stub(MainUtil.StreamingProtocol)
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    test.end()
  })

  getHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  getHandlerTest.test('registerGetBulkTransferHandler should', registerHandlerTest => {
    registerHandlerTest.test('returns true when registering the GET bulk transfer handler', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      const result = await allBulkTransferHandlers.registerGetBulkTransferHandler()
      test.equal(result, true)
      test.end()
    })

    registerHandlerTest.test('return an error when registering GET bulk transfer handler.', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())
        await allBulkTransferHandlers.registerGetBulkTransferHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    registerHandlerTest.end()
  })

  getHandlerTest.test('get bulk transfer by id should', getBulkTransferTest => {
    getBulkTransferTest.test('return true on a single message', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return true on an array of messages', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when an error is passed in', async (test) => {
      try {
        const localMessages = MainUtil.clone(messages)
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.returns(config)
        await allBulkTransferHandlers.getBulkTransfer(true, localMessages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    getBulkTransferTest.test('return an error when the Kafka topic is invalid', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Consumer.getConsumer.throws(new Error())
      Kafka.getKafkaConfig.returns(config)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when the bulk transfer by id is not found', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns({ isValid: true })
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      BulkTransferModel.getById.returns(null)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when the bulk transfer by id is not found - autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns({ isValid: true })
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      BulkTransferModel.getById.returns(null)
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when the requester is not involved in the bulk transfer', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns({ isValid: true })
      Validator.validateParticipantBulkTransferId.returns(false)
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      BulkTransferModel.getById.returns({})
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      localMessages[0].value.from = 'invalidfsp'
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when the requester is not involved in the bulk transfer - autocommit disabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns({ isValid: true })
      Validator.validateParticipantBulkTransferId.returns(false)
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      BulkTransferModel.getById.returns({})
      Consumer.isConsumerAutoCommitEnabled.returns(false)
      localMessages[0].value.from = 'invalidfsp'
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('return an error when the bulk transfer by id is found - autocommit enabled', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.getKafkaConfig.returns(config)
      Validator.validateParticipantByName.returns({ isValid: true })
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      BulkTransferModel.getById.withArgs(bulkTransfer.bulkTransferId).returns(Promise.resolve(bulkTransferReturn))
      Consumer.isConsumerAutoCommitEnabled.returns(true)
      const result = await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
      test.equal(result, true)
      test.end()
    })

    getBulkTransferTest.test('log an error when general message cannot be produced', async (test) => {
      const localMessages = MainUtil.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.proceed.throws(new Error())
      Validator.validateParticipantByName.returns({ isValid: true })
      BulkTransferService.getParticipantsById.withArgs(bulkTransfer.bulkTransferId).returns({ payeeFsp: bulkTransfer.payeeFsp, payerFsp: bulkTransfer.payerFsp })
      const bulkTransferResult = MainUtil.clone(bulkTransferReturn)
      bulkTransferResult.bulkTransferStateId = Enum.Transfers.BulkProcessingState.PROCESSING
      bulkTransferResult.extensionList = []
      BulkTransferModel.getById.withArgs(bulkTransfer.bulkTransferId).returns(Promise.resolve(bulkTransferResult))
      const bulkTransferResult2 = {
        ...bulkTransferResult,
        bulkTransferState: 'COMPLETED',
        payerBulkTransfer: {
          bulkTransferState: 'COMPLETED',
          individualTransferResults: []
        },
        payeeBulkTransfer: {
          bulkTransferState: 'COMPLETED',
          individualTransferResults: []
        }
      }
      BulkTransferService.getBulkTransferById.withArgs(bulkTransfer.bulkTransferId).returns(Promise.resolve(bulkTransferResult2))

      try {
        await allBulkTransferHandlers.getBulkTransfer(null, localMessages)
        const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
        test.ok(SpanStub.finish.calledWith('', expectedState))
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    getBulkTransferTest.end()
  })

  getHandlerTest.end()
})
