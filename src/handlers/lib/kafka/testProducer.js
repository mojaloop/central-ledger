// @TODO to be cleaned up, used for testing the handlers

'use strict'

const Producer = require('./producer')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Utility = require('../utility')

const transfer = {
  transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
  payerFsp: 'fsp1',
  payeeFsp: 'fsp2',
  amount:
    {
      currency: 'USD',
      amount: '433.885'
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

// const topicConf = {
//   topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'transfer', 'prepare'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }

const topicConf = {
  topicName: Utility.transformGeneralTopicName('transfer', 'transfer'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

exports.testProducer = async () => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'TRANSFER')
  config.logger = Logger
  const producer = await Producer.produceMessage(messageProtocol, topicConf, config)
  return true
}
