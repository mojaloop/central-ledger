'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Mustache = require('mustache')
const P = require('bluebird')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const KafkaProducer = require('@mojaloop/central-services-shared').Kafka.Producer

const Utility = require('../../../../src/handlers/lib/utility')

let participantName
const TRANSFER = 'transfer'
const PREPARE = 'prepare'
const FULFIL = 'fulfil'
const COMMIT = 'commit'
const CONSUMER = 'CONSUMER'

const participantTopic = 'topic-testParticipant-transfer-prepare'
const generalTopic = 'topic-transfer-fulfil'

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
    header: {},
    payload: transfer
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'prepare',
      action: 'commit',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0,
        description: 'action successful'
      }
    }
  },
  pp: ''
}

const defaultConfig = {
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
    'client.id': 'transfer-prepare',
    'debug': 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  },
  logger: Logger
}

Test('Utility Test', utilityTest => {
  let sandbox

  utilityTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
    participantName = 'testParticipant'
    test.end()
  })

  utilityTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  utilityTest.test('createParticipantTopicConf should', createParticipantTopicConfTest => {
    createParticipantTopicConfTest.test('return a participant topic conf object', test => {
      const response = Utility.createParticipantTopicConf(participantName, TRANSFER, PREPARE)
      test.equal(response.topicName, participantTopic)
      test.equal(response.partition, 0)
      test.equal(response.opaqueKey, 0)
      test.end()
    })

    createParticipantTopicConfTest.test('throw error when Mustache cannot find config', test => {
      try {
        Sinon.stub(Mustache, 'render').throws(new Error())
        Utility.createParticipantTopicConf(participantName, TRANSFER, PREPARE)
        test.fail('No Error thrown')
        test.end()
        Mustache.render.restore()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
        Mustache.render.restore()
      }
    })

    createParticipantTopicConfTest.end()
  })

  utilityTest.test('createGeneralTopicConf should', createGeneralTopicConfTest => {
    createGeneralTopicConfTest.test('return a general topic conf object', test => {
      const response = Utility.createGeneralTopicConf(TRANSFER, FULFIL)
      test.equal(response.topicName, generalTopic)
      test.equal(response.partition, 0)
      test.equal(response.opaqueKey, 0)
      test.end()
    })

    createGeneralTopicConfTest.test('throw error when Mustache cannot find config', test => {
      try {
        Sinon.stub(Mustache, 'render').throws(new Error())
        Utility.createGeneralTopicConf(TRANSFER, FULFIL)
        test.fail('No Error thrown')
        test.end()
        Mustache.render.restore()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
        Mustache.render.restore()
      }
    })

    createGeneralTopicConfTest.end()
  })

  utilityTest.test('updateMessageProtocolMetadata should', updateMessageProtocolMetadataTest => {
    updateMessageProtocolMetadataTest.test('return an updated metadata object in the message protocol', test => {
      const previousEventId = messageProtocol.metadata.event.id
      const newMessageProtocol = Utility.updateMessageProtocolMetadata(messageProtocol, TRANSFER, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.state, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.type, TRANSFER)
      test.equal(newMessageProtocol.metadata.event.responseTo, previousEventId)
      test.end()
    })

    updateMessageProtocolMetadataTest.end()
  })

  utilityTest.test('getKafkaConfig should', getKafkaConfigTest => {
    getKafkaConfigTest.test('return the Kafka config from the default.json', test => {
      const config = Utility.getKafkaConfig(CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
      test.deepEqual(config, defaultConfig)
      test.end()
    })

    getKafkaConfigTest.test('throw and error if Kafka config not in default.json', test => {
      try {
        Utility.getKafkaConfig(CONSUMER, TRANSFER, PREPARE)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    getKafkaConfigTest.end()
  })

  utilityTest.test('createTransferMessageProtocol should', createTransferMessageProtocolTest => {
    createTransferMessageProtocolTest.test('return a new messageProtocol', test => {
      const createdMessageProtocol = Utility.createTransferMessageProtocol(transfer, PREPARE, COMMIT, Utility.ENUMS.STATE.SUCCESS)
      messageProtocol.metadata.event.type = createdMessageProtocol.metadata.event.type
      createdMessageProtocol.metadata.event.id = messageProtocol.metadata.event.id
      createdMessageProtocol.metadata.event.responseTo = messageProtocol.metadata.event.responseTo
      createdMessageProtocol.metadata.event.createdAt = messageProtocol.metadata.event.createdAt
      test.deepEqual(createdMessageProtocol, messageProtocol)
      test.end()
    })

    createTransferMessageProtocolTest.end()
  })

  utilityTest.test('produceGeneralMessage should', produceGeneralMessageTest => {
    produceGeneralMessageTest.test('produce a general message', async (test) => {
      const result = await Utility.produceGeneralMessage(TRANSFER, PREPARE, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      test.equal(result, true)
      test.end()
    })

    produceGeneralMessageTest.end()
  })

  utilityTest.test('produceParticipantMessage should', produceParticipantMessageTest => {
    produceParticipantMessageTest.test('produce a participant message', async (test) => {
      const result = await Utility.produceParticipantMessage(participantName, TRANSFER, PREPARE, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      test.equal(result, true)
      test.end()
    })

    produceParticipantMessageTest.end()
  })

  utilityTest.test('createState should', createStateTest => {
    createStateTest.test('create a state', async (test) => {
      const state = {
        status: 'status',
        code: 1,
        description: 'description'
      }
      const result = await Utility.createState(state.status, state.code, state.description)
      test.deepEqual(result, state)
      test.end()
    })

    createStateTest.end()
  })

  utilityTest.test('createPrepareErrorStatus should', createPrepareErrorStatusTest => {
    createPrepareErrorStatusTest.test('create Prepare Error Status', async (test) => {
      const errorInformation = {
        errorCode: 3000,
        errorDescription: 'description',
        extensionList: []
      }
      const result = await Utility.createPrepareErrorStatus(errorInformation.errorCode, errorInformation.errorDescription, errorInformation.extensionList)
      test.deepEqual(result.errorInformation, errorInformation)
      test.end()
    })

    createPrepareErrorStatusTest.end()
  })

  utilityTest.end()
})
