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

const Test = require('tape')
const Logger = require('@mojaloop/central-services-shared').Logger
const Uuid = require('uuid4')

const Config = require('../../../src/lib/config')
const Handlers = require('../../../src/handlers/handlers')
const Db = require('@mojaloop/central-services-database').Db
const Producer = require('../../../src/handlers/lib/kafka/producer')
const Utility = require('../../../src/handlers/lib/utility')
const ParticipantHelper = require('../helpers/participant')
const ParticipantLimitHelper = require('../helpers/participantLimit')
const TransferFacade = require('../../../src/models/transfer/facade')
const Moment = require('moment')
const Enum = require('../../../src/lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction

const delay = 20 // seconds
let testData = {
  amount: {
    currency: 'USD',
    amount: 100
  },
  payer: {
    name: 'payer',
    limit: 500
  },
  payee: {
    name: 'payee',
    limit: 300
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const prepareTestData = async (data) => {
  await Db.connect(Config.DATABASE_URI)
  let payer = await ParticipantHelper.prepareData(data.payer.name, data.amount.currency)
  let payee = await ParticipantHelper.prepareData(data.payee.name, data.amount.currency)
  await ParticipantLimitHelper.prepareInitialPositionAndLimits(payer.participant.name, data.payer.limit)
  await ParticipantLimitHelper.prepareInitialPositionAndLimits(payee.participant.name, data.payee.limit)

  const transfer = {
    transferId: Uuid(),
    payerFsp: payer.participant.name,
    payeeFsp: payee.participant.name,
    amount: {
      currency: data.amount.currency,
      amount: data.amount.amount
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU',
    expiration: data.expiration,
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
    completedTimestamp: data.now,
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

  const reject = Object.assign({}, fulfil, {transferState: TransferState.ABORTED})

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
        type: TransferEventAction.PREPARE,
        action: TransferEventType.PREPARE,
        createdAt: data.now,
        state: {
          status: 'success',
          code: 0
        }
      }
    },
    pp: ''
  }

  const messageProtocolFulfil = JSON.parse(JSON.stringify(messageProtocol))
  messageProtocolFulfil.content.payload = fulfil
  messageProtocolFulfil.metadata.event.id = Uuid()
  messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
  messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

  const messageProtocolReject = JSON.parse(JSON.stringify(messageProtocolFulfil))
  messageProtocolReject.content.payload = reject
  messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

  const topicConfTransferPrepare = {
    topicName: Utility.transformAccountToTopicName(transfer.payerFsp, TransferEventType.TRANSFER, TransferEventType.PREPARE),
    key: 'producerTest',
    partition: 0,
    opaqueKey: 0
  }

  const topicConfTransferFulfil = {
    topicName: Utility.transformGeneralTopicName(TransferEventType.TRANSFER, TransferEventType.FULFIL),
    key: 'producerTest',
    partition: 0,
    opaqueKey: 0
  }

  const participants = [
    {
      name: payer.participant.name,
      currency: data.amount.currency
    },
    {
      name: payee.participant.name,
      currency: data.amount.currency
    }
  ]

  await Handlers.registerAllHandlers()

  return {
    transfer,
    fulfil,
    reject,
    messageProtocol,
    messageProtocolFulfil,
    messageProtocolReject,
    topicConfTransferPrepare,
    topicConfTransferFulfil,
    participants
  }
}

exports.testProducer = async () => {}

Test('Handlers test', async handlersTest => {
  // handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
  //   await registerAllHandlers.test('setup handlers', async (test) => {
  //     await Db.connect(Config.DATABASE_URI)
  //     for (let payload of participants) {
  //       const participant = await ParticipantService.getByName(payload.name)
  //       if (!participant) {
  //         const participantId = await ParticipantService.create({name: payload.name})
  //         await ParticipantService.createParticipantCurrency(participantId, payload.currency)
  //       }
  //     }
  //     await Handlers.registerAllHandlers()
  //     setTimeout(() => {
  //       test.end()
  //     }, delay * 1000)
  //   })

  //   await registerAllHandlers.end()
  // })

  handlersTest.test('transferFulfilCommit should', async transferFulfilCommit => {
    const td = await prepareTestData(testData)

    await transferFulfilCommit.test('update transfer state to RESERVED by PREPARE request', async (test) => {
      var startTime = Moment()
      var targetProcessingTimeInSeconds = delay
      var elapsedSeconds = 0
      let isTransferHandlersPrepareCalled = false
      let result = null

      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocol, td.topicConfTransferPrepare, config)

      setTimeout(async () => {
        while (elapsedSeconds < targetProcessingTimeInSeconds) {
          elapsedSeconds = Moment().diff(startTime, 'seconds')
          // console.log(`elapsedSeconds=${elapsedSeconds}`)
          var transfer = await TransferFacade.getById(td.messageProtocol.id)
          if (transfer) {
            result = true
            isTransferHandlersPrepareCalled = true
          }
        }
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(isTransferHandlersPrepareCalled, true, 'Prepare callback was executed')
        test.equal(result, true, `Prepare callback was executed returned ${result}`)
        test.end()
      }, (delay + 5) * 1000)
    })

    await transferFulfilCommit.test('update transfer state to COMMITTED by FULFIL request', async (test) => {
      var startTime = Moment()
      var targetProcessingTimeInSeconds = delay
      var elapsedSeconds = 0
      let isFulfilHandlerCalled = false
      let isTransferStateCommitted = false
      let isIlpFulfilmentUpdated = false
      let result = null

      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, config)

      setTimeout(async () => {
        while (elapsedSeconds < targetProcessingTimeInSeconds) {
          elapsedSeconds = Moment().diff(startTime, 'seconds')
          // console.log(`elapsedSeconds=${elapsedSeconds}`)
          var transfer = await TransferFacade.getById(td.messageProtocol.id)
          if (transfer) {
            isFulfilHandlerCalled = true
            isTransferStateCommitted = transfer.transferState === TransferState.COMMITTED
            isIlpFulfilmentUpdated = transfer.fulfilment === td.fulfil.fulfilment
            result = true
          }
        }
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(isFulfilHandlerCalled, true, 'Fulfil callback was executed')
        test.equal(isTransferStateCommitted, true, 'Transfer state changed to COMMITTED')
        test.equal(isIlpFulfilmentUpdated, true, 'Fulfilment updated ilp table record')
        test.equal(result, true, `Fulfil callback was executed returned ${result}`)
        test.end()
      }, (delay + 5) * 1000)
    })

    // await Producer.disconnect(td.topicConfTransferPrepare.topicName)
    transferFulfilCommit.end()
  })

  // TODO: handlersTest.test('transferFulfilReject should', async transferFulfilReject => {

  // TODO: handlersTest.test('transferPrepareExceedLimit should', async transferPrepareExceedLimit => {

  handlersTest.end()
})

Test.onFinish(async () => {
  process.exit(0)
})
