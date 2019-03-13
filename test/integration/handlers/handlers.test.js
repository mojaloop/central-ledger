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
 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 **********/

'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const retry = require('async-retry')
const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../../../src/lib/config')
const sleep = require('../../../src/lib/time').sleep
const Db = require('@mojaloop/central-services-database').Db
const Consumer = require('../../../src/handlers/lib/kafka/consumer')
const Producer = require('../../../src/handlers/lib/kafka/producer')
const Utility = require('../../../src/handlers/lib/utility')
const ParticipantHelper = require('../helpers/participant')
const ParticipantLimitHelper = require('../helpers/participantLimit')
const ParticipantEndpointHelper = require('../helpers/participantEndpoint')
const TransferService = require('../../../src/domain/transfer')
const ParticipantService = require('../../../src/domain/participant')
const TransferExtensionModel = require('../../../src/models/transfer/transferExtension')
const Handlers = {
  index: require('../../../src/handlers/register'),
  positions: require('../../../src/handlers/positions/handler'),
  transfers: require('../../../src/handlers/transfers/handler')
}
const Enum = require('../../../src/lib/enum')
const TransferState = Enum.TransferState
const TransferEventType = Enum.transferEventType
const TransferEventAction = Enum.transferEventAction

const debug = false
const rebalanceDelay = 10000
const retryDelay = 500
const retryCount = 40
const retryOpts = {
  retries: retryCount,
  minTimeout: retryDelay,
  maxTimeout: retryDelay
}

let testData = {
  amount: {
    currency: 'USD',
    amount: 110
  },
  payer: {
    name: 'payerfsp',
    limit: 500
  },
  payee: {
    name: 'payeefsp',
    limit: 300
  },
  endpoint: {
    base: 'http://localhost:1080',
    email: 'test@example.com'
  },
  now: new Date(),
  expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)) // tomorrow
}

const prepareTestData = async (dataObj) => {
  let payer = await ParticipantHelper.prepareData(dataObj.payer.name, dataObj.amount.currency)
  let payee = await ParticipantHelper.prepareData(dataObj.payee.name, dataObj.amount.currency)

  const kafkacat = `GROUP=abc; T=topic; TR=transfer; kafkacat -b localhost -G $GROUP $T-$TR-prepare $T-$TR-position $T-$TR-fulfil $T-$TR-get $T-admin-$TR $T-notification-event`
  if (debug) console.error(kafkacat)

  let payerLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payer.participant.name, {
    currency: dataObj.amount.currency,
    limit: { value: dataObj.payer.limit }
  })
  let payeeLimitAndInitialPosition = await ParticipantLimitHelper.prepareLimitAndInitialPosition(payee.participant.name, {
    currency: dataObj.amount.currency,
    limit: { value: dataObj.payee.limit }
  })

  for (let name of [payer.participant.name, payee.participant.name]) {
    await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${dataObj.endpoint.base}/transfers`)
    await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${dataObj.endpoint.base}/transfers/{{transferId}}`)
    await ParticipantEndpointHelper.prepareData(name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${dataObj.endpoint.base}/transfers/{{transferId}}/error`)
  }

  const transfer = {
    transferId: Uuid(),
    payerFsp: payer.participant.name,
    payeeFsp: payee.participant.name,
    amount: {
      currency: dataObj.amount.currency,
      amount: dataObj.amount.amount
    },
    ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
    condition: 'GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM',
    expiration: dataObj.expiration,
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

  const header = {
    'fspiop-destination': payee.participant.name,
    'fspiop-source': payer.participant.name
  }

  const fulfil = {
    fulfilment: 'UNlJ98hZTY_dsw0cAqw4i_UN3v4utt7CZFB4yfLbVFA',
    completedTimestamp: dataObj.now,
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

  const reject = Object.assign({}, fulfil, { transferState: TransferState.ABORTED_REJECTED })

  const messageProtocol = {
    id: transfer.transferId,
    from: transfer.payerFsp,
    to: transfer.payeeFsp,
    type: 'application/json',
    content: {
      headers: header,
      payload: transfer
    },
    metadata: {
      event: {
        id: Uuid(),
        type: TransferEventAction.PREPARE,
        action: TransferEventType.PREPARE,
        createdAt: dataObj.now,
        state: {
          status: 'success',
          code: 0
        }
      }
    }
  }

  const messageProtocolFulfil = JSON.parse(JSON.stringify(messageProtocol))
  messageProtocolFulfil.content.payload = fulfil
  messageProtocolFulfil.metadata.event.id = Uuid()
  messageProtocolFulfil.metadata.event.type = TransferEventType.FULFIL
  messageProtocolFulfil.metadata.event.action = TransferEventAction.COMMIT

  const messageProtocolReject = JSON.parse(JSON.stringify(messageProtocolFulfil))
  messageProtocolReject.content.payload = reject
  messageProtocolReject.metadata.event.action = TransferEventAction.REJECT

  const topicConfTransferPrepare = Utility.createGeneralTopicConf(TransferEventType.TRANSFER, TransferEventType.PREPARE, transfer.transferId)
  const topicConfTransferFulfil = Utility.createGeneralTopicConf(TransferEventType.TRANSFER, TransferEventType.FULFIL, transfer.transferId)

  return {
    transfer,
    fulfil,
    reject,
    messageProtocol,
    messageProtocolFulfil,
    messageProtocolReject,
    topicConfTransferPrepare,
    topicConfTransferFulfil,
    payer,
    payerLimitAndInitialPosition,
    payee,
    payeeLimitAndInitialPosition
  }
}

Test('Handlers test', async handlersTest => {
  let startTime = new Date()
  await handlersTest.test('registerAllHandlers should', async registerAllHandlers => {
    await registerAllHandlers.test(`setup handlers`, async (test) => {
      await Db.connect(Config.DATABASE_URI)
      await Handlers.transfers.registerPrepareHandler()
      await Handlers.positions.registerPositionHandler()
      await Handlers.transfers.registerFulfilHandler()

      sleep(rebalanceDelay, debug, 'registerAllHandlers', 'awaiting registration of common handlers')

      test.pass('done')
      test.end()
    })

    await registerAllHandlers.end()
  })

  await handlersTest.test('transferFulfilCommit should', async transferFulfilCommit => {
    const td = await prepareTestData(testData)

    await transferFulfilCommit.test(`update transfer state to RESERVED by PREPARE request`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocol, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerInitialPosition = td.payerLimitAndInitialPosition.participantPosition.value
        const payerExpectedPosition = payerInitialPosition + td.transfer.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position incremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferFulfilCommit.test(`update transfer state to COMMITTED by FULFIL request`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolFulfil, td.topicConfTransferFulfil, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        const payeeCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payee.participantCurrencyId) || {}
        const payeeInitialPosition = td.payeeLimitAndInitialPosition.participantPosition.value
        const payeeExpectedPosition = payeeInitialPosition - td.transfer.amount.amount
        const payeePositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payeeCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer.transferState, TransferState.COMMITTED, `Transfer state changed to ${TransferState.COMMITTED}`)
        test.equal(transfer.fulfilment, td.fulfil.fulfilment, 'Commit ilpFulfilment saved')
        test.equal(payeeCurrentPosition.value, payeeExpectedPosition, 'Payee position decremented by transfer amount and updated in participantPosition')
        test.equal(payeePositionChange.value, payeeCurrentPosition.value, 'Payee position change value inserted and matches the updated participantPosition value')
        test.equal(payeePositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payee position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.COMMITTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferFulfilCommit.end()
  })

  await handlersTest.test('transferFulfilReject should', async transferFulfilReject => {
    testData.amount.amount = 15
    const td = await prepareTestData(testData)

    await transferFulfilReject.test(`update transfer state to RESERVED by PREPARE request`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocol, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferFulfilReject.test(`update transfer state to ABORTED_REJECTED by ABORT request`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocolReject, td.topicConfTransferFulfil, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerExpectedPosition = testData.amount.amount - td.transfer.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer.transferState, TransferState.ABORTED_REJECTED, `Transfer state changed to ${TransferState.ABORTED_REJECTED}`)
        test.equal(transfer.fulfilment, td.fulfil.fulfilment, 'Reject ilpFulfilment saved')
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position decremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.ABORTED_REJECTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferFulfilReject.end()
  })

  await handlersTest.test('transferPrepareExceedLimit should', async transferPrepareExceedLimit => {
    testData.amount.amount = 1100
    const td = await prepareTestData(testData)

    await transferPrepareExceedLimit.test(`fail the transfer if the amount is higher than the remaining participant limit`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocol, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer.transferState, TransferState.ABORTED_REJECTED, `Transfer state changed to ${TransferState.ABORTED_REJECTED}`)
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.ABORTED_REJECTED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferPrepareExceedLimit.end()
  })

  await handlersTest.test('transferAbort should', async transferAbort => {
    testData.amount.amount = 5
    const td = await prepareTestData(testData)

    await transferAbort.test(`update transfer state to RESERVED by PREPARE request`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.PREPARE.toUpperCase())
      config.logger = Logger

      const producerResponse = await Producer.produceMessage(td.messageProtocol, td.topicConfTransferPrepare, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        test.equal(producerResponse, true, 'Producer for prepare published message')
        test.equal(transfer.transferState, TransferState.RESERVED, `Transfer state changed to ${TransferState.RESERVED}`)
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.RESERVED) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    await transferAbort.test(`update transfer state to ABORTED_ERROR by PUT /transfers/{id}/error endpoint`, async (test) => {
      const config = Utility.getKafkaConfig(
        Utility.ENUMS.PRODUCER,
        TransferEventType.TRANSFER.toUpperCase(),
        TransferEventType.FULFIL.toUpperCase())
      config.logger = Logger

      const errorPayload = {
        errorInformation: {
          errorCode: 5101,
          errorDescription: 'Payee transaction limit reached',
          extensionList: {
            extension: [{
              key: 'errorDetail',
              value: 'This is an abort extension'
            }]
          }
        }
      }
      td.messageProtocolReject.metadata.event.action = 'abort'
      td.messageProtocolReject.content.payload = errorPayload

      const producerResponse = await Producer.produceMessage(td.messageProtocolReject, td.topicConfTransferFulfil, config)

      const tests = async () => {
        const transfer = await TransferService.getById(td.messageProtocol.id) || {}
        const payerCurrentPosition = await ParticipantService.getPositionByParticipantCurrencyId(td.payer.participantCurrencyId) || {}
        const payerExpectedPosition = testData.amount.amount - td.transfer.amount.amount
        const payerPositionChange = await ParticipantService.getPositionChangeByParticipantPositionId(payerCurrentPosition.participantPositionId) || {}
        const transferError = await TransferService.getTransferErrorByTransferId(transfer.transferId)
        const transferExtension = await TransferExtensionModel.getByTransferErrorId(transferError.transferErrorId)
        test.equal(producerResponse, true, 'Producer for fulfil published message')
        test.equal(transfer.transferState, TransferState.ABORTED_ERROR, `Transfer state changed to ${TransferState.ABORTED_ERROR}`)
        test.equal(payerCurrentPosition.value, payerExpectedPosition, 'Payer position decremented by transfer amount and updated in participantPosition')
        test.equal(payerPositionChange.value, payerCurrentPosition.value, 'Payer position change value inserted and matches the updated participantPosition value')
        test.equal(payerPositionChange.transferStateChangeId, transfer.transferStateChangeId, 'Payer position change record is bound to the corresponding transfer state change')
        test.ok(transferError, 'A transfer error has been recorded')
        test.equal(transferError.errorCode, errorPayload.errorInformation.errorCode, 'Transfer error code matches')
        test.equal(transferError.errorDescription, errorPayload.errorInformation.errorDescription, 'Transfer error description matches')
        test.notEqual(transferError.transferStateChangeId, transfer.transferStateChangeId, 'Transfer error record is bound to previous state of transfer')
        test.ok(transferExtension, 'A transfer extension has been recorded')
        test.equal(transferExtension[0].transferId, transfer.transferId, 'Transfer extension recorded with transferErrorId key')
      }

      try {
        await retry(async bail => { // use bail(new Error('to break before max retries'))
          const transfer = await TransferService.getById(td.messageProtocol.id) || {}
          if (transfer.transferState !== TransferState.ABORTED_ERROR) {
            if (debug) console.log(`retrying in ${retryDelay / 1000}s..`)
            throw new Error(`Max retry count ${retryCount} reached after ${retryCount * retryDelay / 1000}s. Tests fail`)
          }
          return tests()
        }, retryOpts)
      } catch (err) {
        Logger.error(err)
        test.fail(err.message)
      }
      test.end()
    })

    transferAbort.end()
  })

  await handlersTest.test('teardown', async (assert) => {
    try {
      await Db.disconnect()
      assert.pass('database connection closed')

      let topics = [
        'topic-transfer-prepare',
        'topic-transfer-position',
        'topic-transfer-fulfil',
        'topic-notification-event'
      ]
      for (let topic of topics) {
        try {
          await Producer.getProducer(topic).disconnect()
          assert.pass(`producer to ${topic} disconnected`)
        } catch (err) {
          assert.pass(err.message)
        }
      }
      for (let topic of topics) {
        try {
          await Consumer.getConsumer(topic).disconnect()
          assert.pass(`consumer to ${topic} disconnected`)
        } catch (err) {
          assert.pass(err.message)
        }
      }

      if (debug) {
        let elapsedTime = Math.round(((new Date()) - startTime) / 100) / 10
        console.log(`handlers.test.js finished in (${elapsedTime}s)`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  handlersTest.end()
})
