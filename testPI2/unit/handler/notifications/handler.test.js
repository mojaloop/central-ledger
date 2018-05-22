'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const allTransferHandlers = require('../../../../src/handlers/notification/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferQueries = require('../../../../src/domain/transfer/queries')
const TransferHandler = require('../../../../src/domain/transfer')
const Utility = require('../../../../src/handlers/lib/utility')
const KafkaConsumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const DAO = require('../../../../src/handlers/lib/dao')

const topicName = 'topic-test'

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

const command = () => {}

Test('Transfer handler', transferHandlerTest => {
  let sandbox

  transferHandlerTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(DAO)
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(P.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(P.resolve())
    sandbox.stub(Validator)
    sandbox.stub(TransferQueries)
    sandbox.stub(TransferHandler)
    sandbox.stub(Utility)
    Utility.transformAccountToTopicName.returns(topicName)
    Utility.produceGeneralMessage.returns(P.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
    registerHandlersTest.test('registers registerNotificationHandler', async (test) => {
      Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerNotificationHandler()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('throws error registerFulfillHandler', async (test) => {
      try {
        Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.throws(new Error)
        await allTransferHandlers.registerNotificationHandler()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('registers registerNotificationHandler', async (test) => {
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.end()
  })

  transferHandlerTest.end()
})
