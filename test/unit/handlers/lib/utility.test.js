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
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/

'use strict'

const src = '../../../../src'
const rewire = require('rewire')
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Mustache = require('mustache')
const P = require('bluebird')
const Uuid = require('uuid4')
const KafkaProducer = require('@mojaloop/central-services-stream').Kafka.Producer
const Proxyquire = require('proxyquire')
const Utility = require('../../../../src/handlers/lib/utility')
const Enum = require('../../../../src/lib/enum')
const MainUtil = require('../../../../src/lib/util')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

let participantName
const TRANSFER = 'transfer'
const PREPARE = 'prepare'
const FULFIL = 'fulfil'
// const COMMIT = 'commit'
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
      const response = Utility.createParticipantTopicConf(participantName, TRANSFER, PREPARE, 0)
      test.equal(response.topicName, participantTopic)
      test.equal(response.key, 0)
      test.equal(response.partition, null)
      test.equal(response.opaqueKey, null)
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
      const response = Utility.createGeneralTopicConf(TRANSFER, FULFIL, 0)
      test.equal(response.topicName, generalTopic)
      test.equal(response.key, 0)
      test.equal(response.partition, null)
      test.equal(response.opaqueKey, null)
      test.end()
    })

    createGeneralTopicConfTest.test('return a general topic conf object using topicMap', test => {
      const ModuleProxy = Proxyquire('../../../../src/handlers/lib/utility', {
        '../../lib/enum': {
          topicMap: {
            transfer: {
              fulfil: {
                functionality: 'transfer',
                action: 'fulfil'
              }
            }
          }
        }
      })
      const response = ModuleProxy.createGeneralTopicConf(TRANSFER, FULFIL, 0)
      test.equal(response.topicName, generalTopic)
      test.equal(response.key, 0)
      test.equal(response.partition, null)
      test.equal(response.opaqueKey, null)
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
      const newMessageProtocol = Utility.updateMessageProtocolMetadata(messageProtocol, TRANSFER, PREPARE, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.state, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.type, TRANSFER)
      test.equal(newMessageProtocol.metadata.event.action, PREPARE)
      test.equal(newMessageProtocol.metadata.event.responseTo, previousEventId)
      test.end()
    })

    updateMessageProtocolMetadataTest.test('return an updated metadata object in the message protocol if metadata is not present', test => {
      const newMessageProtocol = Utility.updateMessageProtocolMetadata({}, TRANSFER, PREPARE, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.state, Utility.ENUMS.STATE.SUCCESS)
      test.equal(newMessageProtocol.metadata.event.type, TRANSFER)
      test.equal(newMessageProtocol.metadata.event.action, PREPARE)
      test.end()
    })

    updateMessageProtocolMetadataTest.end()
  })

  utilityTest.test('getKafkaConfig should', getKafkaConfigTest => {
    getKafkaConfigTest.test('return the Kafka config from the default.json', test => {
      const config = Utility.getKafkaConfig(CONSUMER, TRANSFER.toUpperCase(), PREPARE.toUpperCase())
      test.ok(config.rdkafkaConf !== undefined)
      test.ok(config.options !== undefined)
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
      const createdMessageProtocol = Utility.createTransferMessageProtocol(transfer, PREPARE, PREPARE, Utility.ENUMS.STATE.SUCCESS)
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

    produceGeneralMessageTest.test('produce a general message using topicMap', async (test) => {
      const ModuleProxy = Proxyquire('../../../../src/handlers/lib/utility', {
        '../../lib/enum': {
          topicMap: {
            transfer: {
              prepare: {
                functionality: 'transfer',
                action: 'prepare'
              }
            }
          }
        }
      })
      const result = await ModuleProxy.produceGeneralMessage(TRANSFER, PREPARE, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      test.equal(result, true)
      test.end()
    })

    produceGeneralMessageTest.test('produce a general message', async (test) => {
      try {
        await Utility.produceGeneralMessage(TRANSFER, 'invalid', messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      } catch (e) {
        test.ok(e instanceof Error)
      }
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

    produceParticipantMessageTest.test('produce a participant message using topicMap', async (test) => {
      const ModuleProxy = Proxyquire('../../../../src/handlers/lib/utility', {
        '../../lib/enum': {
          topicMap: {
            transfer: {
              prepare: {
                functionality: 'transfer',
                action: 'prepare'
              }
            }
          }
        }
      })
      const result = await ModuleProxy.produceParticipantMessage(participantName, TRANSFER, PREPARE, messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      test.equal(result, true)
      test.end()
    })

    produceParticipantMessageTest.test('produce a participant message', async (test) => {
      try {
        await Utility.produceParticipantMessage(participantName, TRANSFER, 'invalid', messageProtocol, Utility.ENUMS.STATE.SUCCESS)
      } catch (e) {
        test.ok(e instanceof Error)
      }
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

  utilityTest.test('commitMessageSync should', commitMessageSyncTest => {
    commitMessageSyncTest.test('commit message when auto commit is disabled', async (test) => {
      const kafkaTopic = 'test-topic'
      const message = 'message'
      const commitMessageSyncStub = sandbox.stub()
      const consumerStub = {
        commitMessageSync: commitMessageSyncStub
      }
      const KakfaStub = {
        Consumer: {
          isConsumerAutoCommitEnabled: sandbox.stub().withArgs(kafkaTopic).returns(false)
        }
      }
      const UtilityProxy = rewire(`${src}/handlers/lib/utility`)
      UtilityProxy.__set__('Kafka', KakfaStub)

      await UtilityProxy.commitMessageSync(kafkaTopic, consumerStub, message)
      test.ok(KakfaStub.Consumer.isConsumerAutoCommitEnabled.withArgs(kafkaTopic).calledOnce, 'isConsumerAutoCommitEnabled called once')
      test.ok(commitMessageSyncStub.withArgs(message).calledOnce, 'commitMessageSyncStub called once')
      test.end()
    })

    commitMessageSyncTest.test('skip committing message when auto commit is enabled', async (test) => {
      const kafkaTopic = 'test-topic'
      const message = 'message'
      const commitMessageSyncStub = sandbox.stub()
      const consumerStub = {
        commitMessageSync: commitMessageSyncStub
      }
      const KakfaStub = {
        Consumer: {
          isConsumerAutoCommitEnabled: sandbox.stub().withArgs(kafkaTopic).returns(true)
        }
      }
      const UtilityProxy = rewire(`${src}/handlers/lib/utility`)
      UtilityProxy.__set__('Kafka', KakfaStub)

      await UtilityProxy.commitMessageSync(kafkaTopic, consumerStub, message)
      test.ok(KakfaStub.Consumer.isConsumerAutoCommitEnabled.withArgs(kafkaTopic).calledOnce, 'isConsumerAutoCommitEnabled called once')
      test.equal(commitMessageSyncStub.withArgs(message).callCount, 0, 'commitMessageSyncStub not called')
      test.end()
    })

    commitMessageSyncTest.end()
  })

  utilityTest.test('breadcrumb should', breadcrumbTest => {
    breadcrumbTest.test('reset location method when provided by message object', (test) => {
      const location = { module: 'Module', method: '', path: '' }
      const message = { method: 'method' }
      const expected = 'Module::method'

      const result = Utility.breadcrumb(location, message)
      test.equal(location.method, message.method, 'method reset')
      test.equal(result, expected, 'result matched')
      test.end()
    })

    breadcrumbTest.test('reset location path when provided by message object', (test) => {
      const location = { module: 'Module', method: 'method', path: '' }
      const message = { path: 'path' }
      const expected = 'Module::method::path'

      const result = Utility.breadcrumb(location, message)
      test.equal(location.path, `${location.module}::${location.method}::${message.path}`, 'path reset')
      test.equal(result, expected, 'result matched')
      test.end()
    })

    breadcrumbTest.test('append location path when provided by message string', (test) => {
      const path = 'path'
      const location = { module: 'Module', method: 'method', path }
      const message = 'message'
      const expected = `${path}::${message}`

      const result = Utility.breadcrumb(location, message)
      test.equal(location.path, `${path}::${message}`, 'path appended')
      test.equal(result, expected, 'result matched')
      test.end()
    })

    breadcrumbTest.test('return path unchanged when message is not provided', (test) => {
      const path = 'path'
      const location = { module: 'Module', method: 'method', path }
      const expected = `${path}`

      const result = Utility.breadcrumb(location)
      test.equal(result, expected, 'result matched')
      test.end()
    })

    breadcrumbTest.end()
  })

  utilityTest.test('proceed should', async proceedTest => {
    const commitMessageSyncStub = sandbox.stub().returns(Promise.resolve())
    // const createPrepareErrorStatusStub = sandbox.stub().returns('PrepareErrorStatus')
    const createStateSpy = sandbox.spy(Utility.createState) // tub().returns('metadataState')
    const produceGeneralMessageStub = sandbox.stub().returns(Promise.resolve())
    const histTimerEndStub = sandbox.stub()
    const successState = Utility.ENUMS.STATE.SUCCESS
    const failureStatus = Utility.ENUMS.STATE.FAILURE.status
    const from = 'from'
    const extList = []
    const message = {
      value: {
        content: {
          payload: {
            extensionList: extList
          },
          headers: {
            'fspiop-destination': 'dfsp'
          }
        },
        from
      }
    }
    const transferId = Uuid()
    const kafkaTopic = 'kafkaTopic'
    const consumer = 'consumer'
    const params = { message, transferId, kafkaTopic, consumer }
    const producer = { functionality: 'functionality', action: 'action' }
    const UtilityProxy = rewire(`${src}/handlers/lib/utility`)
    UtilityProxy.__set__('commitMessageSync', commitMessageSyncStub)
    // UtilityProxy.__set__('createPrepareErrorStatus', createPrepareErrorStatusStub)
    UtilityProxy.__set__('createState', createStateSpy)
    UtilityProxy.__set__('produceGeneralMessage', produceGeneralMessageStub)

    proceedTest.test('commitMessageSync when consumerCommit and produce toDestination', async test => {
      const opts = { consumerCommit: true, producer, toDestination: true }
      try {
        const result = await UtilityProxy.proceed(params, opts)
        const p = producer
        test.ok(commitMessageSyncStub.calledOnce, 'commitMessageSyncStub called once')
        test.ok(produceGeneralMessageStub.withArgs(p.functionality, p.action, message.value, successState).calledOnce, 'produceGeneralMessageStub called once')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('produce fromSwitch and do not stop timer', async test => {
      const opts = { fromSwitch: true, producer, histTimerEnd: true }
      try {
        const result = await UtilityProxy.proceed(params, opts)
        const p = producer
        test.ok(produceGeneralMessageStub.withArgs(p.functionality, p.action, message.value, successState).calledTwice, 'produceGeneralMessageStub called twice')
        test.equal(message.value.to, from, 'message destination set to sender')
        test.equal(message.value.from, Enum.headers.FSPIOP.SWITCH, 'from set to switch')
        test.equal(histTimerEndStub.callCount, 0, 'timer running')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('create error status and end timer', async test => {
      const desc = 'desc'
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(desc).toApiErrorObject()
      const opts = { fspiopError, histTimerEnd: histTimerEndStub }
      try {
        const result = await UtilityProxy.proceed(params, opts)
        test.ok(createStateSpy.withArgs(failureStatus, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription).calledOnce, 'createStateStub called once')
        test.ok(histTimerEndStub.calledOnce, 'histTimerEndStub called once')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('create error status and end timer with uriParams', async test => {
      const desc = 'desc'
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(desc).toApiErrorObject()
      const opts = { fspiopError, histTimerEnd: histTimerEndStub }
      try {
        const localParams = MainUtil.clone(params)
        localParams.message.value.content.uriParams = { id: Uuid() }
        const result = await UtilityProxy.proceed(localParams, opts)
        test.ok(createStateSpy.withArgs(failureStatus, fspiopError.errorInformation.errorCode, fspiopError.errorInformation.errorDescription).calledTwice, 'createStateStub called twice')
        test.ok(histTimerEndStub.calledTwice, 'histTimerEndStub called twice')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.end()
  })

  utilityTest.end()
})
