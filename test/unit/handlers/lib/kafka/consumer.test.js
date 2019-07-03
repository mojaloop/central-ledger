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
const rewire = require('rewire')
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Consumer = require(`${src}/handlers/lib/kafka/consumer`)
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer

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
    createHandlerTest.test('topic is still added if fails to connect', async (test) => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const topicName = 'admin'
      const config = { rdkafkaConf: {} }
      KafkaConsumer.prototype.connect.throws(new Error())

      // Act
      await ConsumerProxy.createHandler(topicName, config)
      const topics = ConsumerProxy.getListOfTopics()

      // Assert
      test.deepEqual(topics, [topicName], 'Topic should still be in list even if consumer failed to connect.')
      test.end()
    })

    createHandlerTest.test('array topic', async (test) => {
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const topicName = ['admin2', 'admin1']
      const config = { rdkafkaConf: {} }
      try {
        await ConsumerProxy.createHandler(topicName, config)
        test.pass('passed')
      } catch (err) {
        test.fail('Error Thrown')
      }
      test.end()
    })

    createHandlerTest.test('should have a timestamp of 0 if couldn\'t connect', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const topicName = ['admin2', 'admin1']
      const config = { rdkafkaConf: {} }
      KafkaConsumer.prototype.connect.throws(new Error())

      // Act
      await ConsumerProxy.createHandler(topicName, config)
      const result = ConsumerProxy.__get__('listOfConsumers')
      const timestamps = Object.keys(result).map(k => result[k].connectedTimeStamp)

      // Assert
      test.deepEqual(timestamps, [0, 0], 'Timestamps should be 0')
      test.end()
    })

    createHandlerTest.test('should contain a timestamp of when it connected', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const topicName = ['admin2', 'admin1']
      const config = { rdkafkaConf: {} }
      // KafkaConsumer.prototype.connect.throws(new Error())

      // Act
      await ConsumerProxy.createHandler(topicName, config)
      const result = ConsumerProxy.__get__('listOfConsumers')
      const timestamps = Object.keys(result).map(k => result[k].connectedTimeStamp)

      // Assert
      timestamps.forEach(ts => test.ok(ts > 0, 'Timestamp should be greater than 0'))
      test.end()
    })

    createHandlerTest.end()
  })

  ConsumerTest.test('getListOfTopics should', getListOfTopicsTest => {
    getListOfTopicsTest.test('return an empty array when there are no topics', test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', { })
      const expected = []

      // Act
      const result = ConsumerProxy.getListOfTopics()

      // Assert
      test.deepEqual(result, expected, 'Should return an empty array')
      test.end()
    })

    getListOfTopicsTest.test('return a list of topics', test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', { admin1: {}, admin2: {} })
      const expected = ['admin1', 'admin2']

      // Act
      const result = ConsumerProxy.getListOfTopics()

      // Assert
      test.deepEqual(result, expected, 'Should return an empty array')
      test.end()
    })

    getListOfTopicsTest.end()
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
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)

      // Act
      try {
        await ConsumerProxy.getConsumer(topicName)
        test.fail('Error not thrown!')
      } catch (err) {
        // Assert
        test.pass()
      }
      test.end()
    })

    getConsumerTest.end()
  })

  ConsumerTest.test('isConsumerAutoCommitEnabled should', isConsumerAutoCommitEnabledTest => {
    const topicName = 'admin'

    isConsumerAutoCommitEnabledTest.test('return consumer auto commit status', async (test) => {
      const topicName = 'admin'
      const autoCommitEnabled = false
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', { admin: { autoCommitEnabled } })
      try {
        const result = await ConsumerProxy.isConsumerAutoCommitEnabled(topicName)
        test.equal(result, false, 'auto commit is disabled')
      } catch (err) {
        test.fail()
      }
      test.end()
    })

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

  ConsumerTest.test('isConnected should', isConnectedTest => {
    isConnectedTest.test('reject with an error if client.getMetadata fails', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', {
        admin: {
          consumer: {
            // Callback with error
            getMetadata: (options, cb) => {
              const error = new Error('test err message')
              cb(error, null)
            }
          }
        }
      })

      // Act
      try {
        await ConsumerProxy.isConnected('admin')
        test.fail('Error not thrown!')
      } catch (err) {
        // Assert
        test.equal(err.message, 'Error connecting to consumer: test err message', 'Error message does not match')
        test.pass()
      }
      test.end()
    })

    isConnectedTest.test('reject with an error if client.getMetadata passes, but metadata is mising topic', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const metadata = {
        orig_broker_id: 0,
        orig_broker_name: 'kafka:9092/0',
        topics: [],
        brokers: [{ id: 0, host: 'kafka', port: 9092 }]
      }
      ConsumerProxy.__set__('listOfConsumers', {
        admin: {
          consumer: {
            // Callback with error
            getMetadata: (options, cb) => cb(null, metadata)
          }
        }
      })

      // Act
      try {
        await ConsumerProxy.isConnected('admin')
        test.fail('Error not thrown!')
      } catch (err) {
        // Assert
        test.equal(err.message, 'Connected to consumer, but admin not found.', 'Error message does not match')
        test.pass()
      }
      test.end()
    })

    isConnectedTest.test('reject with an error if consumer does not exist', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      ConsumerProxy.__set__('listOfConsumers', {})

      // Act
      try {
        await ConsumerProxy.isConnected('admin')
        test.fail('Error not thrown!')
      } catch (err) {
        // Assert
        test.equal(err.message, 'No consumer found for topic admin', 'Error message does not match')
        test.pass()
      }
      test.end()
    })

    isConnectedTest.test('pass if the topic can be found', async test => {
      // Arrange
      let ConsumerProxy = rewire(`${src}/handlers/lib/kafka/consumer`)
      const metadata = {
        orig_broker_id: 0,
        orig_broker_name: 'kafka:9092/0',
        topics: [
          { name: 'admin', partitions: [] }
        ],
        brokers: [{ id: 0, host: 'kafka', port: 9092 }]
      }
      ConsumerProxy.__set__('listOfConsumers', {
        admin: {
          consumer: {
            // Callback with error
            getMetadata: (options, cb) => cb(null, metadata)
          }
        }
      })

      // Act
      let result
      try {
        result = await ConsumerProxy.isConnected('admin')
      } catch (err) {
        test.fail(err.message)
      }

      // Assert
      test.equal(result, true, 'isConnected should return true')
      test.end()
    })

    isConnectedTest.end()
  })

  ConsumerTest.end()
})
