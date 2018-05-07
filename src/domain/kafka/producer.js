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

// @TODO to be cleaned up, used for testing the handlers

'use strict'

const Producer = require('@mojaloop/central-services-shared').Kafka.Producer
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8039',
  payerFsp: 'fsp1',
  payeeFsp: 'fsp2',
  amount:
  {
    currency: 'USD',
    amount: '99.99'
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
  topicName: 'topic-fsp1-transfer-prepare',
  key: 'producertest',
  partition: 0,
  opaqueKey: 0
}

const config = {
  options: {
    messageCharset: 'utf8'
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
  },
  logger: Logger
}

var testProducer = async () => {
  Logger.info('testProducer::start')

  var p = new Producer(config)
  Logger.info('testProducer::connect::start')
  var connectionResult = await p.connect()
  Logger.info('testProducer::connect::end')

  Logger.info(`Connected result=${connectionResult}`)

  Logger.info('testProducer::sendMessage::start1')
  Logger.info(`testProducer.sendMessage:: messageProtocol:'${JSON.stringify(messageProtocol)}'`)
  await p.sendMessage(messageProtocol, topicConf).then(results => {
    Logger.info(`testProducer.sendMessage:: result:'${JSON.stringify(results)}'`)
  })
  Logger.info('testProducer::sendMessage::end1')
}

testProducer()


const produceMessage = async () => {

}
