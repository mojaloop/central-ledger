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

 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 --------------
 ******/

'use strict'

const Producer = require('../../../src/handlers/lib/kafka/producer')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')
const Utility = require('../../../src/handlers/lib/utility')
const Enum = require('../../../src/lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction
const amount = parseFloat(Number(Math.floor(Math.random() * 100 * 100) / 100 + 100).toFixed(2)) // decimal amount between 100.01 and 200.00
const expiration = new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow

const transfer = {
  transferId: Uuid(),
  payerFsp: 'dfsp1',
  payeeFsp: 'dfsp2',
  amount: {
    currency: 'USD',
    amount
  },
  ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
  condition: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
  expiration,
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
  transferState: TransferState.COMMITTED,
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

/*
let messageProtocol = {
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
      type: TransferEventAction.PREPARE,
      action: TransferEventType.PREPARE,
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
const messageProtocolFulfilReject = {
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
      action: 'reject',
      createdAt: new Date(),
      state: {
        status: 'success',
        code: 0
      }
    }
  },
  pp: ''
}
*/

const topicConfTransferPrepare = {
  topicName: Utility.transformAccountToTopicName(transfer.payerFsp, TransferEventType.TRANSFER, TransferEventType.PREPARE),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}

exports.transferPrepare = async () => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.PREPARE.toUpperCase())
  config.logger = Logger
  // extend the message with topic information
  const transferObj = requestBodys().messageProtocol()
  console.log('******************************transfer object.....******************************************')
  console.log(transferObj)
  console.log(topicConfTransferPrepare)

  console.log('**********************************************************************')
  await Producer.produceMessage(transferObj, topicConfTransferPrepare, config)
  return transferObj.id
  // return true
}

const topicConfTransferFulfil = {
  topicName: Utility.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.FULFIL),
  key: 'producerTest',
  partition: 0,
  opaqueKey: 0
}
exports.transferFulfil = async (transferId) => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
  config.logger = Logger
  const fulfilObj = requestBodys(transferId).messageProtocolFulfil()
  console.log('******************************fulfill object.....******************************************')
  console.log(fulfilObj)
  console.log(topicConfTransferFulfil)
  console.log('**********************************************************************')
  await Producer.produceMessage(fulfilObj, topicConfTransferFulfil, config)
  return fulfilObj.transferId
}

exports.transferFulfilReject = async (transferId) => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, 'TRANSFER', 'REJECT')
  config.logger = Logger
  const fulfilRejectObj = requestBodys(transferId).messageProtocolFulfilReject()
  console.log('******************************fulfillReject object.....******************************************')
  console.log(fulfilRejectObj)
  console.log(topicConfTransferFulfil)
  console.log('**********************************************************************')
  await Producer.produceMessage(fulfilRejectObj, topicConfTransferFulfil, config)
  return true
}
exports.transferReject = async (transferId) => {
  const config = Utility.getKafkaConfig(Utility.ENUMS.PRODUCER, TransferEventType.TRANSFER.toUpperCase(), TransferEventType.FULFIL.toUpperCase())
  config.logger = Logger
  const rejectObj = requestBodys(transferId).messageProtocolReject()
  console.log('******************************Reject object.....******************************************')
  console.log(rejectObj)
  console.log(topicConfTransferFulfil)
  console.log('**********************************************************************')
  await Producer.produceMessage(rejectObj, topicConfTransferFulfil, config)
  return true
}

// var prepareCounter = 0
// var fulfilCounter = 0
// var abortCounter = 0

// // var conter = 0

// exports.producePrepareForPositions = async () => {
//   const message = requestBodys().messageProtocol()
//   await Utility.produceParticipantMessage(message.from, Utility.ENUMS.POSITION, '0.prepare', message, Utility.ENUMS.STATE.SUCCESS)
// //  await Utility.produceParticipantMessage(, Utility.ENUMS.POSITION, PREPARE, message.value, Utility.ENUMS.STATE.SUCCESS)
// }

// exports.produceFulfilForPositions = async () => {
//   const message = requestBodys().messageProtocolFulfil()
//   await Utility.produceParticipantMessage(message.from, Utility.ENUMS.POSITION, '2.fulfil', message, Utility.ENUMS.STATE.SUCCESS)
// }

// exports.produceAbortForPositions = async () => {
//   const message = requestBodys().messageProtocolFulfilReject()
//   await Utility.produceParticipantMessage(message.from, Utility.ENUMS.POSITION, '1.abort', message, Utility.ENUMS.STATE.SUCCESS)
// }

// const prepareTestMessage = () => {
//   return {
//     metadata: {
//       event: {
//         id: Uuid(),
//         type: 'prepare',
//         state: ''
//       }
//     },
//     value: {
//       counter: ++prepareCounter,
//       dfsp: 'dfsp1',
//       type: 'prepare'
//     }
//   }
// }

// const fulfilTestMessage = () => {
//   return {
//     counter: ++fulfilCounter,
//     dfsp: 'dfsp1',
//     type: 'fulfil'
//   }
// }

// const abortTestMessage = () => {
//   return {
//     counter: ++abortCounter,
//     dfsp: 'dfsp1',
//     type: 'abort'
//   }
// }

const requestBodys = (transferId = null) => {
  const localTransfer = Object.assign({}, transfer, { transferId: transferId || Uuid() })
  const localFulfil = Object.assign({}, fulfil, { completedTimestamp: new Date() })
  const localReject = Object.assign({}, fulfil, {transferState: TransferState.ABORTED})

  return {
    messageProtocol: function () {
      return {
        id: localTransfer.transferId,
        from: localTransfer.payerFsp,
        to: localTransfer.payeeFsp,
        type: 'application/json',
        content: {
          header: '',
          payload: localTransfer
        },
        metadata: {
          event: {
            id: Uuid(),
            type: 'transfer',
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
    },

    messageProtocolFulfil: function () {
      return {
        id: localTransfer.transferId,
        from: localTransfer.payerFsp,
        to: localTransfer.payeeFsp,
        type: 'application/json',
        content: {
          header: '',
          payload: localFulfil
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
    },

    messageProtocolFulfilReject: function () {
      return {
        id: localTransfer.transferId,
        from: localTransfer.payerFsp,
        to: localTransfer.payeeFsp,
        type: 'application/json',
        content: {
          header: '',
          payload: localFulfil
        },
        metadata: {
          event: {
            id: Uuid(),
            type: 'fulfil',
            action: 'reject',
            createdAt: new Date(),
            state: {
              status: 'success',
              code: 0
            }
          }
        },
        pp: ''
      }
    },

    messageProtocolReject: function () {
      return {
        id: localTransfer.transferId,
        from: localTransfer.payerFsp,
        to: localTransfer.payeeFsp,
        type: 'application/json',
        content: {
          header: '',
          payload: localReject
        },
        metadata: {
          event: {
            id: Uuid(),
            type: 'fulfil',
            action: TransferEventAction.REJECT,
            createdAt: new Date(),
            state: {
              status: 'success',
              code: 0
            }
          }
        },
        pp: ''
      }
    }
  }
}

exports.requestBodys = requestBodys
