// @TODO to be cleaned up, used for testing the handlers

'use strict'

const Producer = require('../../../src/handlers/lib/kafka/producer')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Utility = require('../../../src/handlers/lib/utility')

const transfer = {
  transferId: Uuid(),
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount: '466.88'
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0',
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
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

const fulfil = {
  fulfilment: 'oAKAAA',
  completedTimestamp: new Date(),
  transferState: 'COMMITTED',
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

const messageProtocolFulfil = {
  id: transfer.transferId,
  from: transfer.payerFsp,
  to: transfer.payeeFsp,
  type: 'application/json',
  content: {
    header: '',
    payload: fulfil
  },
  metadata: {
    event: {
      id: Uuid(),
      type: 'fulfil',
      action: 'commit',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}

const topicConfTransferPrepare = {
  topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'transfer', 'prepare'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}
exports.transferPrepare = async () => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'PREPARE')
  config.logger = Logger
  await Producer.produceMessage(messageProtocol, topicConfTransferPrepare, config)
  return true
}

const topicConfTransferFulfil = {
  topicName: Utility.transformGeneralTopicName('transfer', 'fulfil'),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}
exports.transferFulfil = async () => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'FULFIL')
  config.logger = Logger
  await Producer.produceMessage(messageProtocolFulfil, topicConfTransferFulfil, config)
  return true
}

// const topicConfPositionPrepare = {
//   topicName: Utility.transformAccountToTopicName(transfer.payerFsp, 'position', 'prepare'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }
// exports.positionPrepare = async () => {
//   const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'POSITION', 'PREPARE')
//   config.logger = Logger
//   await Producer.produceMessage(messageProtocol, topicConfPositionPrepare, config)
//   return true
// }

// const topicConfTransferTransfer = {
//   topicName: Utility.transformGeneralTopicName('transfer', 'transfer'),
//   key: 'producerTest',
//   partition: 0,
//   opaqueKey: 0
// }
// exports.transferTransfer = async () => {
//   const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'TRANSFER')
//   config.logger = Logger
//   await Producer.produceMessage(messageProtocol, topicConfTransferTransfer, config)
//   return true
// }
