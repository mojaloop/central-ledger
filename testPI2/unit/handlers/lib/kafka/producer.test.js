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

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const KafkaProducer = require('@mojaloop/central-services-shared').Kafka.Producer
const Producer = require('../../../../../src/handlers/lib/kafka/producer')
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
  let config = {}

  producerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
    t.end()
  })

  producerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  producerTest.test('produceMessage should', produceMessageTest => {
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
  producerTest.end()
})

Test('Producer Failure', producerTest => {
  let sandbox
  let config = {}

  producerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'connect').throws(new Error())
    sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'disconnect').throws(new Error())
    t.end()
  })

  producerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  producerTest.test('produceMessage should', produceMessageTest => {
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

    produceMessageTest.test('throw error when no producer to disconnect', async (test) => {
      try {
        await Producer.disconnect(topicConf.topicName)
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error Thrown')
        test.end()
      }
    })

    produceMessageTest.end()
  })
  producerTest.end()
})
