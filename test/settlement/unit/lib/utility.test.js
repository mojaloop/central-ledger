'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const idGenerator = require('@mojaloop/central-services-shared').Util.id

const KafkaProducer = require('@mojaloop/central-services-stream').Kafka.Producer
const Utility = require('../../../../src/settlement/lib/utility')

const NOTIFICATION = 'notification'
const EVENT = 'event'

const generalTopic = 'topic-notification-event'
const generateULID = idGenerator({ type: 'ulid' })
const messageProtocol = {
  id: generateULID(),
  from: 'central-switch',
  to: 'dfsp1',
  type: 'application/json',
  content: {
    header: {
      'Content-Type': 'application/json',
      Date: '2019-01-17T14:46:48.918Z',
      'FSPIOP-Source': 'central-switch',
      'FSPIOP-Destination': 'dfsp1'
    },
    payload: {
      currency: 'USD',
      value: 0,
      changedDate: '2019-01-17T14:46:48.918Z'
    }
  },
  metadata: {
    event: {
      id: generateULID(),
      type: 'dummy',
      action: 'settlement-transfer-position-change',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0,
        description: 'action successful'
      }
    }
  }
}

Test('Utility Test', utilityTest => {
  let sandbox

  utilityTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
    test.end()
  })

  utilityTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  utilityTest.test('generalTopicTemplate should', generalTopicTemplateTest => {
    generalTopicTemplateTest.test('fill in missing fields with empty strings', test => {
      const out = Utility.generalTopicTemplate()
      test.equal(out, 'topic--')
      test.end()
    })

    generalTopicTemplateTest.end()
  })

  utilityTest.test('getKafkaConfig should', getKafkaConfigTest => {
    getKafkaConfigTest.test('return the Kafka config from the default.json', test => {
      const producer = 'PRODUCER'
      const functionality = 'notification'
      const action = 'event'
      const config = Utility.getKafkaConfig(producer, functionality.toUpperCase(), action.toUpperCase())
      test.ok(config.rdkafkaConf !== undefined)
      test.ok(config.options !== undefined)
      test.end()
    })

    getKafkaConfigTest.test('throw and error if Kafka config not in default.json', test => {
      try {
        const producer = 'PRODUCER'
        const functionality = 'notification'
        const action = 'event'
        Utility.getKafkaConfig(producer, functionality, action)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    getKafkaConfigTest.end()
  })

  utilityTest.test('updateMessageProtocolMetadata should', updateMessageProtocolMetadataTest => {
    updateMessageProtocolMetadataTest.test('return an updated metadata object in the message protocol', test => {
      const previousEventId = messageProtocol.metadata.event.id
      const newMessageProtocol = Utility.updateMessageProtocolMetadata(messageProtocol, NOTIFICATION, EVENT, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.state, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.type, NOTIFICATION)
      test.equal(newMessageProtocol.metadata.event.responseTo, previousEventId)
      test.end()
    })

    updateMessageProtocolMetadataTest.test('return an updated metadata object in the message protocol if metadata is not present', test => {
      const newMessageProtocol = Utility.updateMessageProtocolMetadata({}, NOTIFICATION, EVENT, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.state, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.type, NOTIFICATION)
      test.equal(newMessageProtocol.metadata.event.action, EVENT)
      test.end()
    })

    updateMessageProtocolMetadataTest.end()
  })

  utilityTest.test('createGeneralTopicConf should', createGeneralTopicConfTest => {
    createGeneralTopicConfTest.test('return a general topic conf object', test => {
      const response = Utility.createGeneralTopicConf(NOTIFICATION, EVENT)
      test.equal(response.topicName, generalTopic)
      test.equal(response.partition, 0)
      test.equal(response.opaqueKey, 0)
      test.end()
    })

    createGeneralTopicConfTest.end()
  })

  utilityTest.test('produceGeneralMessage should', produceGeneralMessageTest => {
    produceGeneralMessageTest.test('produce a general message', async (test) => {
      const result = await Utility.produceGeneralMessage(NOTIFICATION, EVENT, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      test.equal(result, true)
      test.end()
    })

    produceGeneralMessageTest.test('produce a general message', async (test) => {
      try {
        await Utility.produceGeneralMessage(NOTIFICATION, 'invalid', messageProtocol, Utility.ENUMS.STATE.SUCCESS)
        test.fail('Error not thrown!')
      } catch (e) {
        test.ok(e instanceof Error)
      }
      test.end()
    })

    produceGeneralMessageTest.end()
  })

  utilityTest.end()
})
