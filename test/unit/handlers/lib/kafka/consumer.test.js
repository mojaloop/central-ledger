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
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer

const rewire = require('rewire')

Test('Consumer', ConsumerTest => {
  let sandbox

  ConsumerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaConsumer.prototype, 'constructor').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'connect').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'consume').resolves()
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').resolves()
    test.end()
  })

  ConsumerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  ConsumerTest.test('createHandler should', createHandlerTest => {
    createHandlerTest.test('throw error', async (test) => {
      const topicName = 'admin'
      const config = { rdkafkaConf: {} }
      KafkaConsumer.prototype.constructor.throws(new Error())
      KafkaConsumer.prototype.connect.throws(new Error())
      try {
        await Consumer.createHandler(topicName, config)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass()
      }
      test.end()
    })

    createHandlerTest.test('array topic', async (test) => {
      const topicName = ['admin2', 'admin1']
      const config = { rdkafkaConf: {} }
      try {
        await Consumer.createHandler(topicName, config)
        test.pass('passed')
      } catch (err) {
        test.fail('Error Thrown')
      }
      test.end()
    })

    createHandlerTest.test('array topic throws error', async (test) => {
      const topicName = ['admin2', 'admin1']
      const config = { rdkafkaConf: {} }
      KafkaConsumer.prototype.consume.throws(new Error())
      try {
        await Consumer.createHandler(topicName, config)
        test.fail('Error Not Thrown')
      } catch (err) {
        test.pass('passed')
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
