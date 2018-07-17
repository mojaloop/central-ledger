'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const allTransferHandlers = require('../../../../src/handlers/positions/handler')
const Kafka = require('../../../../src/handlers/lib/kafka')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const Utility = require('../../../../src/handlers/lib/utility')
const KafkaConsumer = require('@mojaloop/central-services-shared').Kafka.Consumer
const DAO = require('../../../../src/handlers/lib/dao')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const TransferStateChange = require('../../../../src/models/transfer/transferStateChange')
const transferEventAction = require('../../../../src/lib/enum').transferEventAction

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
  id: transfer.transferId,
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    header: '',
    payload: transfer
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'position',
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

const messages = [
  {
    value: messageProtocol
  }
]

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
    sandbox.stub(Utility)
    sandbox.stub(TransferStateChange)
    Utility.transformAccountToTopicName.returns(topicName)
    Utility.produceGeneralMessage.returns(P.resolve())
    test.end()
  })

  transferHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transferHandlerTest.test('createPrepareHandler should', registerHandlersTest => {
    registerHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      DAO.retrieveAllParticipants.returns(P.resolve(participants))
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('Register a consumer on Kafka', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      await DAO.retrieveAllParticipants.returns(P.resolve(participants))
      const result = await allTransferHandlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerHandlersTest.test('Throw error retrieveAllParticipants', async (test) => {
      try {
        Kafka.Consumer.createHandler(topicName, config, command)
        await DAO.retrieveAllParticipants.returns(P.resolve(participants))
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.throws(new Error())
        await allTransferHandlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.test('Log and skip consumer registration when no participants', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        await DAO.retrieveAllParticipants.returns(P.resolve([]))
        const result = await allTransferHandlers.registerAllHandlers()
        test.equal(result, false)
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerHandlersTest.end()
  })

  transferHandlerTest.test('positions should be able to', positionsTest => {
    positionsTest.test('Update transferStateChange in the database for PREPARE when single message', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      const result = await allTransferHandlers.positions(null, messages[0])
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for COMMIT when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      messages[0].value.metadata.event.action = transferEventAction.COMMIT
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for REJECT when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      messages[0].value.metadata.event.action = transferEventAction.REJECT
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RECEIVED when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      messages[0].value.metadata.event.action = transferEventAction.TIMEOUT_RECEIVED
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })
    positionsTest.test('Update transferStateChange in the database for TIMEOUT_RESERVED when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      messages[0].value.metadata.event.action = transferEventAction.TIMEOUT_RESERVED
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })
    positionsTest.test('Update transferStateChange in the database for FAIL when messages is an array', async (test) => {
      await Kafka.Consumer.createHandler(topicName, config, command)
      Utility.transformGeneralTopicName.returns(topicName)
      Utility.getKafkaConfig.returns(config)
      TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
      messages[0].value.metadata.event.action = transferEventAction.FAIL
      const result = await allTransferHandlers.positions(null, messages)
      Logger.info(result)
      test.equal(result, true)
      test.end()
    })

    positionsTest.test('Throw error when invalid action is recieved', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
        messages[0].value.metadata.event.action = 'invalid'
        await allTransferHandlers.positions(null, messages)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    positionsTest.test('Throw error on positions', async (test) => {
      try {
        await Kafka.Consumer.createHandler(topicName, config, command)
        Utility.transformGeneralTopicName.returns(topicName)
        Utility.getKafkaConfig.returns(config)
        TransferStateChange.saveTransferStateChange.returns(P.resolve(true))
        await allTransferHandlers.positions(new Error(), null)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    positionsTest.end()
  })
  transferHandlerTest.end()
})
