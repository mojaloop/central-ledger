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

 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>

 --------------
 ******/
'use strict'

const src = '../../../../../src/'
const Sinon = require('sinon')
const rewire = require('rewire')
const Test = require('tapes')(require('tape'))
const KafkaProducer = require('@mojaloop/central-services-stream').Kafka.Producer
const Producer = require(`${src}/handlers/lib/kafka/producer`)
const P = require('bluebird')
const Uuid = require('uuid4')

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
      type: 'prepare',
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

const topicConf = {
  topicName: 'topic-dfsp1-transfer-prepare',
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

Test('Producer', producerTest => {
  let sandbox
  const config = {}

  producerTest.test('produceMessage should', produceMessageTest => {
    produceMessageTest.beforeEach(t => {
      sandbox = Sinon.createSandbox()
      sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
      t.end()
    })

    produceMessageTest.afterEach(t => {
      sandbox.restore()
      t.end()
    })

    produceMessageTest.test('return true', async test => {
      const result = await Producer.produceMessage(messageProtocol, topicConf, config)
      test.equal(result, true)
      await Producer.disconnect(topicConf.topicName)
      test.end()
    })

    produceMessageTest.test('disconnect specific topic correctly', async test => {
      try {
        topicConf.topicName = 'someTopic'
        await Producer.produceMessage(messageProtocol, topicConf, config)
        await Producer.disconnect(topicConf.topicName)
        test.pass('Disconnect specific topic successfully')
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    produceMessageTest.test('disconnect all topics correctly', async test => {
      try {
        topicConf.topicName = 'someTopic1'
        await Producer.produceMessage(messageProtocol, topicConf, config)
        topicConf.topicName = 'someTopic2'
        await Producer.produceMessage(messageProtocol, topicConf, config)
        await Producer.disconnect()
        test.pass('Disconnected all topics successfully')
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    produceMessageTest.end()
  })

  producerTest.test('getProducer should', getProducerTest => {
    getProducerTest.beforeEach(t => {
      sandbox = Sinon.createSandbox()
      sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
      t.end()
    })

    getProducerTest.afterEach(t => {
      sandbox.restore()
      t.end()
    })

    getProducerTest.test('fetch a specific Producers', async test => {
      await Producer.produceMessage({}, { topicName: 'test' }, {})
      test.ok(Producer.getProducer('test'))
      test.end()
    })

    getProducerTest.test('throw an exception for a specific Producers not found', async test => {
      try {
        test.ok(Producer.getProducer('undefined'))
        test.fail('Error not thrown!')
      } catch (e) {
        test.ok(e.toString() === 'Error: No producer found for topic undefined')
      }
      test.end()
    })

    getProducerTest.end()
  })

  producerTest.test('disconnect should', disconnectTest => {
    disconnectTest.beforeEach(t => {
      sandbox = Sinon.createSandbox()
      sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
      t.end()
    })

    disconnectTest.afterEach(t => {
      sandbox.restore()
      t.end()
    })
    disconnectTest.test('disconnect from kafka', async test => {
      await Producer.produceMessage({}, { topicName: 'test' }, {})
      test.ok(Producer.disconnect('test'))
      test.end()
    })

    disconnectTest.test('disconnect specific topic correctly', async test => {
      try {
        const topicName = 'someTopic'
        test.ok(await Producer.produceMessage({}, { topicName: topicName }, {}))
        await Producer.disconnect(topicName)
        test.pass('Disconnect specific topic successfully')
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    disconnectTest.test('disconnect all topics correctly', async test => {
      try {
        let topicName = 'someTopic1'
        test.ok(await Producer.produceMessage({}, { topicName: topicName }, {}))
        await Producer.disconnect(topicName)
        topicName = 'someTopic2'
        test.ok(await Producer.produceMessage({}, { topicName: topicName }, {}))
        await Producer.disconnect()
        test.pass('Disconnected all topics successfully')
        test.end()
      } catch (e) {
        test.fail('Error thrown')
        test.end()
      }
    })

    disconnectTest.test('throw error if failure to disconnect from kafka when disconnecting all Producers', async test => {
      try {
        // setup stubs for getProducer method
        const topicNameSuccess = 'topic1'
        var topicNameFailure = 'topic2'
        var getProducerStub = sandbox.stub()
        getProducerStub.returns(new KafkaProducer({}))
        getProducerStub.withArgs(topicNameFailure).throws(`No producer found for topic ${topicNameFailure}`)

        // lets rewire the producer import
        const KafkaProducerProxy = rewire(`${src}/handlers/lib/kafka/producer`)

        // lets override the getProducer method within the import
        KafkaProducerProxy.__set__('getProducer', getProducerStub)

        await KafkaProducerProxy.produceMessage({}, { topicName: topicNameSuccess }, {})
        await KafkaProducerProxy.produceMessage({}, { topicName: topicNameFailure }, {})

        await KafkaProducerProxy.disconnect()

        test.fail()
        test.end()
      } catch (e) {
        test.ok(e instanceof Error)
        test.ok(e.toString() === `Error: The following Producers could not be disconnected: [{"topic":"${topicNameFailure}","error":"No producer found for topic ${topicNameFailure}"}]`)
        test.end()
      }
      getProducerStub.restore()
    })

    disconnectTest.test('throw error if failure to disconnect from kafka if topic does not exist', async test => {
      try {
        const topicName = 'someTopic'
        await Producer.produceMessage({}, { topicName: topicName }, {})
        await Producer.disconnect('undefined')
      } catch (e) {
        test.ok(e instanceof Error)
        test.end()
      }
    })

    disconnectTest.test('throw error when a non-string value is passed into disconnect', async (test) => {
      try {
        const badTopicName = {}
        await Producer.disconnect(badTopicName)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    disconnectTest.end()
  })

  producerTest.test('produceMessage failure should', produceMessageTest => {
    produceMessageTest.beforeEach(t => {
      sandbox = Sinon.createSandbox()
      sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'connect').throws(new Error())
      sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
      sandbox.stub(KafkaProducer.prototype, 'disconnect').throws(new Error())
      t.end()
    })

    produceMessageTest.afterEach(t => {
      sandbox.restore()
      t.end()
    })

    produceMessageTest.test('throw error when connect throws error', async test => {
      try {
        topicConf.topicName = 'invalidTopic'
        await Producer.produceMessage(messageProtocol, topicConf, config)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    produceMessageTest.end()
  })

  producerTest.end()
})
