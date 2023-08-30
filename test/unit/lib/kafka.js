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

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Uuid = require('uuid4')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const MainUtil = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum
const Config = require('#src/lib/config')
const clone = require('@mojaloop/central-services-shared').Util.clone
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const KafkaLib = require('#src/lib/kafka')

Test('Kafka Lib Test', kafkaLibTest => {
  let sandbox

  kafkaLibTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })

  kafkaLibTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  kafkaLibTest.test('proceed should', async proceedTest => {
    let proceedSandbox
    let commitMessageSyncStub
    let produceGeneralMessageStub

    proceedTest.beforeEach(test => {
      proceedSandbox = Sinon.createSandbox()
      commitMessageSyncStub = sandbox.stub().returns(Promise.resolve())
      produceGeneralMessageStub = sandbox.stub().returns(Promise.resolve())
      proceedSandbox.stub(Kafka, 'commitMessageSync').callsFake(commitMessageSyncStub)
      proceedSandbox.stub(Kafka, 'produceGeneralMessage').callsFake(produceGeneralMessageStub)
      test.end()
    })

    proceedTest.afterEach(test => {
      proceedSandbox.restore()
      test.end()
    })

    const successState = Enum.Events.EventStatus.SUCCESS
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
    const producer = 'producer'
    const params = { message, transferId, kafkaTopic, consumer, decodedPayload: message.value.content.payload, producer }
    const eventDetail = { functionality: 'functionality', action: 'action' }

    proceedTest.test('commitMessageSync when consumerCommit', async test => {
      const opts = { consumerCommit: true, eventDetail }
      try {
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, params, opts)
        test.ok(commitMessageSyncStub.calledOnce, 'commitMessageSyncStub called once')
        test.ok(produceGeneralMessageStub.withArgs(Config.KAFKA_CONFIG, producer, eventDetail.functionality, eventDetail.action, message.value, successState).calledOnce, 'produceGeneralMessageStub called once')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('commitMessageSync when consumerCommit and messageKey is specified', async test => {
      const opts = { consumerCommit: true, eventDetail, messageKey: '1' }
      try {
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, params, opts)
        test.ok(commitMessageSyncStub.calledOnce, 'commitMessageSyncStub called once')
        test.ok(produceGeneralMessageStub.withArgs(Config.KAFKA_CONFIG, producer, eventDetail.functionality, eventDetail.action, message.value, successState, '1').calledOnce, 'produceGeneralMessageStub called once')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('produce fromSwitch and do not stop timer', async test => {
      const opts = { fromSwitch: true, eventDetail }
      try {
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, params, opts)
        test.ok(produceGeneralMessageStub.withArgs(Config.KAFKA_CONFIG, producer, eventDetail.functionality, eventDetail.action, message.value, successState).calledOnce, 'produceGeneralMessageStub called twice')
        test.equal(message.value.to, from, 'message destination set to sender')
        test.equal(message.value.from, Enum.Http.Headers.FSPIOP.SWITCH.value, 'from set to switch')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('produce fromSwitch without headers', async test => {
      const opts = { fromSwitch: true, eventDetail }
      try {
        const localParams = clone(params)
        delete localParams.message.value.content.headers
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, localParams, opts)
        test.ok(produceGeneralMessageStub.withArgs(Config.KAFKA_CONFIG, producer, eventDetail.functionality, eventDetail.action, localParams.message.value, successState).calledOnce, 'produceGeneralMessageStub called twice')
        test.equal(message.value.to, from, 'message destination set to sender')
        test.equal(message.value.from, Enum.Http.Headers.FSPIOP.SWITCH.value, 'from set to switch')
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('create error status and end timer', async test => {
      const desc = 'desc'
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(desc).toApiErrorObject()
      const opts = { fspiopError }
      try {
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, params, opts)
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.test('create error status and end timer with uriParams', async test => {
      const desc = 'desc'
      const fspiopError = ErrorHandler.Factory.createInternalServerFSPIOPError(desc).toApiErrorObject()
      const opts = { fspiopError }
      try {
        const localParams = MainUtil.clone(params)
        localParams.message.value.content.uriParams = { id: Uuid() }
        const result = await KafkaLib.proceed(Config.KAFKA_CONFIG, localParams, opts)
        test.equal(result, true, 'result returned')
      } catch (err) {
        test.fail(err.message)
      }

      test.end()
    })

    proceedTest.end()
  })

  kafkaLibTest.end()
})
