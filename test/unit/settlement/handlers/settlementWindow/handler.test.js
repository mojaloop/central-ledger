/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventSdk = require('@mojaloop/event-sdk')
const Util = require('@mojaloop/central-services-shared').Util
const Kafka = require('@mojaloop/central-services-shared').Util.Kafka
const Consumer = require('@mojaloop/central-services-stream').Util.Consumer
const KafkaConsumer = require('@mojaloop/central-services-stream').Kafka.Consumer
const Enum = require('@mojaloop/central-services-shared').Enum
const SettlementWindowService = require('../../../../../src/settlement/domain/settlementWindow/index')
const Proxyquire = require('proxyquire')
const idGenerator = require('@mojaloop/central-services-shared').Util.id

const generateULID = idGenerator({ type: 'ulid' })
const payload = {
  settlementWindowId: '3',
  reason: 'test'
}
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
  id: generateULID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp },
    uriParams: { id: transfer.transferId },
    payload
  },
  metadata: {
    event: {
      id: generateULID(),
      type: 'settlement',
      action: 'close',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageProtocolActionNotClosed = {
  id: generateULID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp },
    uriParams: { id: transfer.transferId },
    payload
  },
  metadata: {
    event: {
      id: generateULID(),
      type: 'settlement',
      action: 'notClose',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const messageProtocolMissingPayload = {
  id: generateULID(),
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    headers: { 'fspiop-destination': transfer.payerFsp },
    uriParams: { id: transfer.transferId }
  },
  metadata: {
    event: {
      id: generateULID(),
      type: 'settlement',
      action: 'close',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const topicName = 'topic-test'

const messages = [
  {
    topic: topicName,
    value: messageProtocol
  }
]

const messagesActionNotClosed = [
  {
    topic: topicName,
    value: messageProtocolActionNotClosed
  }
]
const messagesMissingPayload = [
  {
    topic: topicName,
    value: messageProtocolMissingPayload
  }
]

const config = {
  options: {
    mode: 2,
    batchSize: 1,
    pollFrequency: 10,
    recursiveTimeout: 100,
    messageCharset: 'utf8',
    messageAsJSON: true,
    sync: true,
    consumeTimeout: 1000
  },
  rdkafkaConf: {
    'client.id': 'kafka-test',
    debug: 'all',
    'group.id': 'central-ledger-kafka',
    'metadata.broker.list': 'localhost:9092',
    'enable.auto.commit': false
  }
}

const settlementWindow = {
  state: Enum.Settlements.SettlementWindowState.CLOSED
}

const command = () => {}

Test('SettlementWindowHandler', async (settlementWindowHandlerTest) => {
  let sandbox
  let SpanStub
  let SettlementWindowHandler

  settlementWindowHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(KafkaConsumer.prototype, 'constructor').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'connect').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'consume').returns(Promise.resolve())
    sandbox.stub(KafkaConsumer.prototype, 'commitMessageSync').returns(Promise.resolve())
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async function () {
        return true
      }
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    sandbox.stub(Kafka)
    sandbox.stub(Util.StreamingProtocol)
    sandbox.stub(SettlementWindowService)
    Kafka.produceGeneralMessage.returns(Promise.resolve())
    SpanStub = {
      audit: sandbox.stub().callsFake(),
      error: sandbox.stub().callsFake(),
      finish: sandbox.stub().callsFake(),
      setTags: sandbox.stub().callsFake()
    }

    const TracerStub = {
      extractContextFromMessage: sandbox.stub().callsFake(() => {
        return {}
      }),
      createChildSpanFromContext: sandbox.stub().callsFake(() => {
        return SpanStub
      })
    }

    const EventSdkStub = {
      Tracer: TracerStub
    }

    SettlementWindowHandler = Proxyquire('../../../../../src/settlement/handlers/deferredSettlement/handler', {
      '@mojaloop/event-sdk': EventSdkStub
    })
    test.end()
  })

  settlementWindowHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  settlementWindowHandlerTest.test('closeSettlementWindow should', closeSettlementWindowTest => {
    closeSettlementWindowTest.test('close the SettlementWindow when messages is in array', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      SettlementWindowService.close.returns(Promise.resolve(settlementWindow))
      const result = await SettlementWindowHandler.closeSettlementWindow(null, localMessages)
      test.equal(result, true)
      test.end()
    })
    closeSettlementWindowTest.test('close the SettlementWindow when there is a single message', async (test) => {
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      SettlementWindowService.close.returns(Promise.resolve(settlementWindow))
      const result = await SettlementWindowHandler.closeSettlementWindow(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })
    closeSettlementWindowTest.test('retry when the settlement window state is not CLOSED', async (test) => {
      const openSettlementWindow = {
        state: Enum.Settlements.SettlementWindowState.OPEN
      }
      const localMessages = Util.clone(messages)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      SettlementWindowService.close.returns(Promise.resolve(openSettlementWindow))

      const retryStub = sandbox.stub().callsArg(0)
      const SettlementWindowHandlerProxy = Proxyquire('../../../../../src/settlement/handlers/deferredSettlement/handler', {
        'async-retry': retryStub
      })

      const result = await SettlementWindowHandlerProxy.closeSettlementWindow(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })
    closeSettlementWindowTest.test('retry when the settlement window state is not CLOSED and the action is not closed', async (test) => {
      const openSettlementWindow = {
        state: Enum.Settlements.SettlementWindowState.OPEN
      }
      const localMessages = Util.clone(messagesActionNotClosed)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      SettlementWindowService.close.returns(Promise.resolve(openSettlementWindow))

      const retryStub = sandbox.stub().callsArg(0)
      const SettlementWindowHandlerProxy = Proxyquire('../../../../../src/settlement/handlers/deferredSettlement/handler', {
        'async-retry': retryStub
      })

      const result = await SettlementWindowHandlerProxy.closeSettlementWindow(null, localMessages[0])
      test.equal(result, true)
      test.end()
    })
    closeSettlementWindowTest.test('throw error when there is an error', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.proceed.returns(false)
        SettlementWindowService.close.returns(Promise.resolve(settlementWindow))
        await SettlementWindowHandler.closeSettlementWindow(new Error(), null)
        test.fail('should throw')
        test.end()
      } catch (e) {
        test.ok('Error is thrown')
        test.end()
      }
    })
    closeSettlementWindowTest.test('throw -Settlement window handler missing payload- when the payload is missing', async (test) => {
      const localMessages = Util.clone(messagesMissingPayload)
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      SettlementWindowService.close.returns(Promise.resolve(settlementWindow))
      const result = await SettlementWindowHandler.closeSettlementWindow(null, localMessages)
      test.equal(result, true)
      const expectedState = new EventSdk.EventStateMetadata(EventSdk.EventStatusType.failed, '2001', 'Internal server error')
      test.ok(SpanStub.finish.calledWith('Settlement window handler missing payload', expectedState))
      test.end()
    })
    closeSettlementWindowTest.end()
  })
  settlementWindowHandlerTest.test('registerAllHandlers should', registerAllHandlersTest => {
    registerAllHandlersTest.test('register all consumers on Kafka', async (test) => {
      await Consumer.createHandler(topicName, config, command)
      Kafka.transformAccountToTopicName.returns(topicName)
      Kafka.proceed.returns(true)
      Kafka.transformGeneralTopicName.returns(topicName)
      Kafka.getKafkaConfig.returns(config)
      const result = await SettlementWindowHandler.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })
    settlementWindowHandlerTest.test('throw error registerAllHandlers', async (test) => {
      try {
        await Consumer.createHandler(topicName, config, command)
        Kafka.transformAccountToTopicName.returns(topicName)
        Kafka.proceed.returns(true)
        Kafka.transformGeneralTopicName.returns(topicName)
        Kafka.getKafkaConfig.throws(new Error())

        await SettlementWindowHandler.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })
    registerAllHandlersTest.end()
  })
  settlementWindowHandlerTest.end()
})
