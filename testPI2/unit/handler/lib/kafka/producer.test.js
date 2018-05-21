'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const KafkaProducer = require('@mojaloop/central-services-shared').Kafka.Producer
const Producer = require('../../../../../src/handlers/lib/kafka/producer')
const P = require('bluebird')
const KafkaStubs = require('./KafkaStub')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount:
    {
      currency: 'USD',
      amount: '433.88'
    },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
  expiration: '2016-05-24T08:38:08.699-04:00',
  extensionList:
    {
      extension:
        [
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

const config = {
  options: {
    'messageCharset': 'utf8'
  },
  rdkafkaConf: {
    'debug': 'all',
    'metadata.broker.list': 'localhost:9092',
    'client.id': 'default-client',
    'event_cb': true,
    'compression.codec': 'none',
    'retry.backoff.ms': 100,
    'message.send.max.retries': 2,
    'socket.keepalive.enable': true,
    'queue.buffering.max.messages': 10,
    'queue.buffering.max.ms': 50,
    'batch.num.messages': 100,
    'api.version.request': true,
    'dr_cb': true
  }
}

Test('Producer', producerTest => {
  let sandbox
  let ProducerStub
  let config = {}
  let prod

  producerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(KafkaProducer.prototype, 'constructor').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'connect').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'sendMessage').returns(P.resolve())
    sandbox.stub(KafkaProducer.prototype, 'disconnect').returns(P.resolve())
    // ProducerStub = Sinon.createStubInstance(KafkaProducer);
    // prod = new ProducerStub(config)
    t.end()
  })

  producerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  producerTest.test('produceMessage should', produceMessageTest => {
    produceMessageTest.test('return true', async test => {
      //KafkaProducer.connect.returns(P.resolve())
      //KafkaProducer.sendMessage.returns(P.resolve())
      const result = await Producer.produceMessage(messageProtocol, topicConf, config)
      test.equal(result, true)
      await Producer.disconnect()
      test.end()
    })
    produceMessageTest.end()
  })
  producerTest.end()
})
