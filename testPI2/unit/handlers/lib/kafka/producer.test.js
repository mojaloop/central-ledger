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
 --------------
 ******/

'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Logger = require('@mojaloop/central-services-shared').Logger
const Kafka = require(`${src}/lib/kafka`)
const Producer = require('@mojaloop/central-services-shared').Kafka.Producer

Test('Producer', producerTest => {
  let sandbox

  producerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Producer.prototype, 'constructor')
    sandbox.stub(Producer.prototype, 'connect') // .returns(P.resolve(true))
    sandbox.stub(Producer.prototype, 'disconnect') // .returns(P.resolve(true))
    sandbox.stub(Producer.prototype, 'sendMessage').returns(P.resolve(true))

    sandbox.stub(Logger)

    t.end()
  })

  producerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  producerTest.test('produceMessage should', produceMessageTest => {
    produceMessageTest.test('should connect to kafka and publish a message', async test => {
      Producer.prototype.connect.returns(P.resolve(true))
      test.ok(await Kafka.Producer.produceMessage({}, {topicName: 'test'}, {}))
      test.end()
    })

    produceMessageTest.test('should throw error if failure to connect to kafka', async test => {
      const error = new Error()
      Producer.prototype.connect.returns(P.reject(error))

      try {
        await Kafka.Producer.produceMessage({}, {}, {})
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    produceMessageTest.end()
  })

  producerTest.test('disconnect should', disconnectTest => {
    disconnectTest.test('should disconnect from kafka', async test => {
      Producer.prototype.connect.returns(P.resolve(true))
      await Kafka.Producer.produceMessage({}, {topicName: 'test'}, {})
      Producer.prototype.disconnect.returns(P.resolve(true))
      test.ok(Kafka.Producer.disconnect('test'))
      test.end()
    })

    disconnectTest.test('should throw error if failure to disconnect from kafka if topic does not exist', async test => {
      try {
        Producer.prototype.connect.returns(P.resolve(true))
        await Kafka.Producer.produceMessage({}, {topicName: 'test'}, {})
        await Kafka.Producer.disconnect('')
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    disconnectTest.end()
  })
  producerTest.end()
})
