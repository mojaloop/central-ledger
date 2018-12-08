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

 --------------
 ******/
'use strict'

const src = '../../../../../src'
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Consumer = require(`${src}/handlers/lib/kafka/consumer`)
var rewire = require('rewire')

Test('Consumer', ConsumerTest => {
  let sandbox

  ConsumerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    test.end()
  })

  ConsumerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  ConsumerTest.test('createHandler should', createHandlerTest => {
    const topicName = 'admin'
    const config = { rdkafkaConf: {} }

    createHandlerTest.test('throw error', async (test) => {
      try {
        await Consumer.createHandler(topicName, config)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass()
      }
      test.end()
    })

    createHandlerTest.end()
  })

  ConsumerTest.test('getConsumer should', getConsumerTest => {
    const topicName = 'admin'
    const expected = 'consumer'

    getConsumerTest.test('return list of consumers', async (test) => {
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', {
        admin: {
          consumer: expected
        }
      })
      try {
        let result = await ConsumerProxy.getConsumer(topicName)
        test.equal(result, expected)
      } catch (err) {
        test.fail()
      }
      test.end()
    })

    getConsumerTest.test('throw error', async (test) => {
      try {
        await Consumer.getConsumer(topicName)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass()
      }
      test.end()
    })

    getConsumerTest.end()
  })

  ConsumerTest.test('isConsumerAutoCommitEnabled should', isConsumerAutoCommitEnabledTest => {
    const topicName = 'admin'

    isConsumerAutoCommitEnabledTest.test('throw error', async (test) => {
      try {
        await Consumer.isConsumerAutoCommitEnabled(topicName)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass()
      }
      test.end()
    })

    isConsumerAutoCommitEnabledTest.end()
  })

  ConsumerTest.end()
})
