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

 * Kevin Leyow <kevin.leyow@infitx.com>

 --------------
 ******/

'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Db = require('../../../../src/lib/db')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const FulfilService = require('../../../../src/handlers/transfers/FulfilService')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferService = require('../../../../src/domain/transfer')
const FxService = require('../../../../src/domain/fx')
const Participant = require('../../../../src/domain/participant')
const Config = require('../../../../src/lib/config')
const { logger } = require('../../../../src/shared/logger')
const ProxyCache = require('../../../../src/lib/proxyCache')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const fixtures = require('../../../fixtures')
const mocks = require('./mocks')

const { Kafka, Comparators, Hash } = Util
const { Action, Type } = Enum.Events.Event
const { SOURCE, DESTINATION } = Enum.Http.Headers.FSPIOP
const { TransferState, TransferInternalState } = Enum.Transfers
const decodePayload = Util.StreamingProtocol.decodePayload

const log = logger

Test('FulfilService Tests -->', fulfilTest => {
  let sandbox
  let span

  const createFulfilServiceWithTestData = (message) => {
    const payload = decodePayload(message.value.content.payload)
    const headers = message.value.content.headers
    const type = message.value.metadata.event.type
    const action = message.value.metadata.event.action
    const transferId = message.value.content.uriParams.id
    const kafkaTopic = message.topic

    const params = {
      message,
      kafkaTopic,
      span,
      decodedPayload: payload,
      consumer: Consumer,
      producer: Producer
    }
    const service = new FulfilService({
      log,
      Config,
      Comparators,
      Validator,
      TransferService,
      FxService,
      Participant,
      Kafka,
      params
    })

    return {
      service,
      transferId,
      payload,
      headers,
      type,
      action
    }
  }

  fulfilTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Producer)
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(true)
    sandbox.stub(Db)
    sandbox.stub(TransferService)
    sandbox.stub(FxService.Cyril)
    sandbox.stub(Participant)
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })

    Participant.getAccountByNameAndCurrency = sandbox.stub().resolves({
      participantCurrencyId: 123
    })

    // Stub Util.Time.getUTCString to control current time
    sandbox.stub(Util.Time, 'getUTCString').callsFake((date) => date.toISOString())

    FxService.Cyril.processAbortMessage.returns({
      positionChanges: [{
        participantCurrencyId: 1
      }]
    })
    span = mocks.createTracerStub(sandbox).SpanStub
    test.end()
  })

  fulfilTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  fulfilTest.test('getTransferDetails Tests -->', methodTest => {
    methodTest.test('should retrieve transfer successfully', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service, transferId } = createFulfilServiceWithTestData(message)
      const transfer = { transferId, transferState: TransferInternalState.RESERVED }

      TransferService.getById.resolves(transfer)

      const result = await service.getTransferDetails(transferId, Type.POSITION)
      t.deepEqual(result, transfer)
      t.ok(TransferService.getById.calledWith(transferId))
      t.end()
    })

    methodTest.test('should handle transfer not found', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service, transferId } = createFulfilServiceWithTestData(message)

      TransferService.getById.resolves(null)
      service.kafkaProceed = sandbox.stub().resolves()

      try {
        await service.getTransferDetails(transferId, Type.POSITION)
        t.fail('Should throw error')
      } catch (err) {
        t.equal(err.apiErrorCode.code, '2001')
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateTransferState Tests -->', methodTest => {
    methodTest.test('should pass validation for RESERVED state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED,
        transferStateEnumeration: TransferState.RESERVED
      }

      service.kafkaProceed = sandbox.stub()

      const result = await service.validateTransferState(transfer, Type.POSITION, Action.COMMIT)
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should pass validation for RESERVED_FORWARDED state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED_FORWARDED,
        transferStateEnumeration: TransferState.RESERVED
      }

      service.kafkaProceed = sandbox.stub()

      const result = await service.validateTransferState(transfer, Type.POSITION, Action.COMMIT)
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should fail validation for invalid state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.COMMITTED,
        transferStateEnumeration: TransferState.COMMITTED
      }

      service.kafkaProceed = sandbox.stub()

      try {
        await service.validateTransferState(transfer, Type.POSITION, Action.COMMIT)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('Transfer is in invalid state'))
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.test('should emit RESERVED_ABORTED for RESERVE action on invalid state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.COMMITTED,
        transferStateEnumeration: TransferState.COMMITTED,
        payeeFsp: 'dfsp1'
      }

      service.kafkaProceed = sandbox.stub()
      TransferService.getById.resolves(transfer)

      try {
        await service.validateTransferState(transfer, Type.POSITION, Action.RESERVE)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(service.kafkaProceed.calledTwice)
        if (service.kafkaProceed.secondCall) {
          const secondCall = service.kafkaProceed.secondCall.args[0]
          t.equal(secondCall.eventDetail.action, Action.RESERVED_ABORTED)
        } else {
          t.comment('Second call not available, checking first call only')
          t.ok(service.kafkaProceed.called)
        }
      }
      t.end()
    })

    methodTest.test('should fail validation for already finalized transfer on COMMIT', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.COMMITTED,
        transferStateEnumeration: TransferState.COMMITTED
      }

      service.kafkaProceed = sandbox.stub()

      try {
        await service.validateTransferState(transfer, Type.POSITION, Action.COMMIT)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateHeaders Tests -->', methodTest => {
    methodTest.test('should pass validation with correct headers', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        payeeIsProxy: false,
        payerIsProxy: false
      }
      const headers = {
        [SOURCE]: 'dfsp1',
        [DESTINATION]: 'dfsp2'
      }
      const payload = { fulfilment: 'test' }

      service.kafkaProceed = sandbox.stub()

      const result = await service.validateHeaders({
        transfer,
        headers,
        payload,
        action: Action.COMMIT,
        validActionsForRouteValidations: [Action.COMMIT],
        hubName: Config.HUB_NAME
      })
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should skip validation for non-validated actions', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = { transferId: 'test-id' }
      const headers = {}
      const payload = {}

      service.kafkaProceed = sandbox.stub()

      const result = await service.validateHeaders({
        transfer,
        headers,
        payload,
        action: Action.RESERVE,
        validActionsForRouteValidations: [Action.COMMIT],
        hubName: Config.HUB_NAME
      })
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should fail validation for source header mismatch', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        payeeIsProxy: false,
        payerIsProxy: false,
        currency: 'USD'
      }
      const headers = {
        [SOURCE]: 'wrongFsp',
        [DESTINATION]: 'dfsp2'
      }
      const payload = { fulfilment: 'test' }

      service.kafkaProceed = sandbox.stub()
      TransferService.handlePayeeResponse.resolves({})

      try {
        await service.validateHeaders({
          transfer,
          headers,
          payload,
          action: Action.COMMIT,
          validActionsForRouteValidations: [Action.COMMIT],
          hubName: Config.HUB_NAME
        })
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('does not match payee fsp'))
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.test('should fail validation for destination header mismatch', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        payeeIsProxy: false,
        payerIsProxy: false,
        currency: 'USD'
      }
      const headers = {
        [SOURCE]: 'dfsp1',
        [DESTINATION]: 'wrongFsp'
      }
      const payload = { fulfilment: 'test' }

      service.kafkaProceed = sandbox.stub()
      TransferService.handlePayeeResponse.resolves({})

      try {
        await service.validateHeaders({
          transfer,
          headers,
          payload,
          action: Action.COMMIT,
          validActionsForRouteValidations: [Action.COMMIT],
          hubName: Config.HUB_NAME
        })
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('does not match payer fsp'))
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.test('should handle RESERVED_ABORTED for RESERVE action', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payeeFsp: 'dfsp1',
        payerFsp: 'dfsp2',
        payeeIsProxy: false,
        payerIsProxy: false,
        currency: 'USD'
      }
      const headers = {
        [SOURCE]: 'wrongFsp',
        [DESTINATION]: 'dfsp2'
      }
      const payload = { fulfilment: 'test' }

      service.kafkaProceed = sandbox.stub()
      TransferService.handlePayeeResponse.resolves({})
      TransferService.getById.resolves(transfer)

      try {
        await service.validateHeaders({
          transfer,
          headers,
          payload,
          action: Action.RESERVE,
          validActionsForRouteValidations: [Action.RESERVE],
          hubName: Config.HUB_NAME
        })
        t.fail('Should throw error')
      } catch (err) {
        t.ok(service.kafkaProceed.calledTwice)
        if (service.kafkaProceed.secondCall) {
          const secondCall = service.kafkaProceed.secondCall.args[0]
          t.equal(secondCall.eventDetail.action, Action.RESERVED_ABORTED)
        } else {
          t.comment('Second call not available, checking first call only')
          t.ok(service.kafkaProceed.called)
        }
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateExpirationDate Tests -->', methodTest => {
    methodTest.test('should pass validation for future expiration', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const futureDate = new Date()
      futureDate.setTime(Date.now() + 10000)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED,
        expirationDate: futureDate
      }

      service.kafkaProceed = sandbox.stub().resolves()

      const result = await service.validateExpirationDate(transfer, Type.POSITION, Action.COMMIT)
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should pass validation for RESERVED_FORWARDED state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const pastDate = new Date()
      pastDate.setTime(Date.now() - 10000)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED_FORWARDED,
        expirationDate: pastDate
      }

      service.kafkaProceed = sandbox.stub().resolves()

      const result = await service.validateExpirationDate(transfer, Type.POSITION, Action.COMMIT)
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should fail validation for expired transfer', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const pastDate = new Date()
      pastDate.setTime(Date.now() - 10000)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED,
        expirationDate: pastDate,
        payeeFsp: 'dfsp1'
      }

      service.kafkaProceed = sandbox.stub().resolves()

      try {
        await service.validateExpirationDate(transfer, Type.POSITION, Action.COMMIT)
        t.fail('Should throw error')
      } catch (err) {
        t.equal(err.apiErrorCode.code, '3303')
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.test('should handle RESERVED_ABORTED for RESERVE action on expiration', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const pastDate = new Date()
      pastDate.setTime(Date.now() - 10000)
      const transfer = {
        transferId: 'test-id',
        transferState: TransferInternalState.RESERVED,
        expirationDate: pastDate,
        payeeFsp: 'dfsp1'
      }

      service.kafkaProceed = sandbox.stub().resolves()
      TransferService.getById.resolves(transfer)

      try {
        await service.validateExpirationDate(transfer, Type.POSITION, Action.RESERVE)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(service.kafkaProceed.calledTwice)
        if (service.kafkaProceed.secondCall) {
          const secondCall = service.kafkaProceed.secondCall.args[0]
          t.equal(secondCall.eventDetail.action, Action.RESERVED_ABORTED)
        } else {
          t.comment('Second call not available, checking first call only')
          t.ok(service.kafkaProceed.called)
        }
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateFulfilment Tests -->', methodTest => {
    methodTest.test('should pass validation with valid fulfilment', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        condition: fixtures.CONDITION
      }
      const payload = { fulfilment: fixtures.FULFILMENT }

      sandbox.stub(Validator, 'validateFulfilCondition').returns(true)
      service.kafkaProceed = sandbox.stub().resolves()

      const result = await service.validateFulfilment(transfer, payload)
      t.true(result)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should skip validation when no fulfilment provided', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = { transferId: 'test-id' }
      const payload = {}

      const result = await service.validateFulfilment(transfer, payload)
      t.true(result)
      t.end()
    })

    methodTest.test('should fail validation with invalid fulfilment', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        condition: fixtures.CONDITION
      }
      const payload = { fulfilment: 'invalid' }

      sandbox.stub(Validator, 'validateFulfilCondition').returns(false)
      service.kafkaProceed = sandbox.stub()
      TransferService.handlePayeeResponse.resolves({
        completedTimestamp: new Date().toISOString()
      })

      try {
        await service.validateFulfilment(transfer, payload)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('invalid fulfilment'))
        t.ok(service.kafkaProceed.calledOnce)
        t.ok(TransferService.handlePayeeResponse.calledWith(
          transfer.transferId,
          payload,
          Action.ABORT_VALIDATION
        ))
      }
      t.end()
    })

    methodTest.test('should handle cyril result with position changes', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        condition: fixtures.CONDITION
      }
      const payload = { fulfilment: 'invalid' }

      sandbox.stub(Validator, 'validateFulfilCondition').returns(false)
      service.kafkaProceed = sandbox.stub().resolves()
      TransferService.handlePayeeResponse.resolves({
        completedTimestamp: new Date().toISOString()
      })
      FxService.Cyril.processAbortMessage.resolves({
        positionChanges: [{ participantCurrencyId: 456 }]
      })

      try {
        await service.validateFulfilment(transfer, payload)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(service.kafkaProceed.calledOnce)
        const kafkaOpts = service.kafkaProceed.lastCall.args[0]
        t.equal(kafkaOpts.messageKey, '456')
      }
      t.end()
    })

    methodTest.test('should handle cyril result with no position changes', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        condition: fixtures.CONDITION
      }
      const payload = { fulfilment: 'invalid' }

      sandbox.stub(Validator, 'validateFulfilCondition').returns(false)
      service.kafkaProceed = sandbox.stub().resolves()
      TransferService.handlePayeeResponse.resolves({
        completedTimestamp: new Date().toISOString()
      })
      FxService.Cyril.processAbortMessage.resolves({
        positionChanges: []
      })

      try {
        await service.validateFulfilment(transfer, payload)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('Invalid cyril result'))
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('getDuplicateCheckResult Tests -->', methodTest => {
    methodTest.test('should detect duplicate fulfil request [action: commit]', async t => {
      const action = Action.COMMIT
      const message = fixtures.fulfilKafkaMessageDto({ metadata: { event: { action } } })
      const { service, transferId, payload } = createFulfilServiceWithTestData(message)

      TransferService.getTransferFulfilmentDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      TransferService.saveTransferFulfilmentDuplicateCheck.resolves()

      const dupCheckResult = await service.getDuplicateCheckResult({ transferId, payload, action })
      t.ok(dupCheckResult.hasDuplicateId)
      t.ok(dupCheckResult.hasDuplicateHash)
      t.end()
    })

    methodTest.test('should detect error duplicate request [action: abort]', async t => {
      const action = Action.ABORT
      const message = fixtures.fulfilKafkaMessageDto({ metadata: { event: { action } } })
      const { service, transferId, payload } = createFulfilServiceWithTestData(message)

      TransferService.getTransferErrorDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      TransferService.saveTransferErrorDuplicateCheck.resolves()

      const dupCheckResult = await service.getDuplicateCheckResult({ transferId, payload, action })
      t.ok(dupCheckResult.hasDuplicateId)
      t.ok(dupCheckResult.hasDuplicateHash)
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('checkDuplication Tests -->', methodTest => {
    methodTest.test('should return false when no duplicate found', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: false, hasDuplicateHash: false }
      const transfer = { transferId: 'test-id' }

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.COMMIT,
        type: Type.FULFIL
      })
      t.false(result)
      t.end()
    })

    methodTest.test('should handle duplicate with different hash', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: false }
      const transfer = { transferId: 'test-id' }

      service.kafkaProceed = sandbox.stub()

      try {
        await service.checkDuplication({
          dupCheckResult,
          transfer,
          functionality: Type.POSITION,
          action: Action.COMMIT,
          type: Type.FULFIL
        })
        t.fail('Should throw error')
      } catch (err) {
        t.equal(err.apiErrorCode.code, '3106')
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.test('should handle duplicate COMMITTED transfer', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: TransferState.COMMITTED
      }

      service.kafkaProceed = sandbox.stub()
      sandbox.stub(TransferObjectTransform, 'toFulfil').returns({ fulfilment: 'test' })

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.COMMIT,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      const kafkaOpts = service.kafkaProceed.lastCall.args[0]
      t.equal(kafkaOpts.eventDetail.action, Action.FULFIL_DUPLICATE)
      t.end()
    })

    methodTest.test('should handle duplicate ABORTED transfer', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: TransferState.ABORTED
      }

      service.kafkaProceed = sandbox.stub()
      sandbox.stub(TransferObjectTransform, 'toFulfil').returns({ errorInformation: {} })

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.ABORT,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      const kafkaOpts = service.kafkaProceed.lastCall.args[0]
      t.equal(kafkaOpts.eventDetail.action, Action.ABORT_DUPLICATE)
      t.end()
    })

    methodTest.test('should handle duplicate RECEIVED transfer', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: TransferState.RECEIVED
      }

      service.kafkaProceed = sandbox.stub()

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.COMMIT,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      t.end()
    })

    methodTest.test('should handle duplicate RESERVED transfer', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: TransferState.RESERVED
      }

      service.kafkaProceed = sandbox.stub()

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.COMMIT,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      t.end()
    })

    methodTest.test('should not change action for RESERVE action', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: TransferState.COMMITTED
      }

      service.kafkaProceed = sandbox.stub()
      sandbox.stub(TransferObjectTransform, 'toFulfil').returns({ fulfilment: 'test' })

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.RESERVE,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      const kafkaOpts = service.kafkaProceed.lastCall.args[0]
      t.equal(kafkaOpts.eventDetail.action, Action.RESERVE)
      t.end()
    })

    methodTest.test('should handle invalid transfer state', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const dupCheckResult = { hasDuplicateId: true, hasDuplicateHash: true }
      const transfer = {
        transferId: 'test-id',
        transferStateEnumeration: 'INVALID_STATE'
      }

      service.kafkaProceed = sandbox.stub()

      const result = await service.checkDuplication({
        dupCheckResult,
        transfer,
        functionality: Type.POSITION,
        action: Action.COMMIT,
        type: Type.FULFIL
      })
      t.true(result)
      t.ok(service.kafkaProceed.calledOnce)
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateEventType Tests -->', methodTest => {
    methodTest.test('should pass validation for FULFIL event type', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)

      service.kafkaProceed = sandbox.stub()

      await service.validateEventType(Type.FULFIL, Type.POSITION)
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should fail validation for invalid event type', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)

      service.kafkaProceed = sandbox.stub()

      try {
        await service.validateEventType('INVALID_TYPE', Type.POSITION)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('Invalid event type'))
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('validateAction Tests -->', methodTest => {
    methodTest.test('should pass validation for valid actions', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const validActions = [
        Action.COMMIT,
        Action.RESERVE,
        Action.REJECT,
        Action.ABORT,
        Action.BULK_COMMIT,
        Action.BULK_ABORT
      ]

      service.kafkaProceed = sandbox.stub()

      for (const action of validActions) {
        await service.validateAction(action, Type.POSITION)
      }
      t.ok(service.kafkaProceed.notCalled)
      t.end()
    })

    methodTest.test('should fail validation for invalid action', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)

      service.kafkaProceed = sandbox.stub()

      try {
        await service.validateAction('INVALID_ACTION', Type.POSITION)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(err.message.includes('Invalid event action'))
        t.ok(service.kafkaProceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('_handleAbortValidation Tests -->', methodTest => {
    methodTest.test('should handle abort validation with payer account', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payerFsp: 'dfsp1',
        currency: 'USD'
      }
      const apiFSPIOPError = { errorInformation: { errorCode: '3100' } }
      const eventDetail = { functionality: Type.POSITION, action: Action.ABORT_VALIDATION }

      Participant.getAccountByNameAndCurrency.resolves({
        participantCurrencyId: 789
      })
      service.kafkaProceed = sandbox.stub()

      await service._handleAbortValidation(transfer, apiFSPIOPError, eventDetail)

      t.ok(Participant.getAccountByNameAndCurrency.calledWith(
        'dfsp1',
        'USD',
        Enum.Accounts.LedgerAccountType.POSITION
      ))
      t.ok(service.kafkaProceed.calledOnce)
      const kafkaOpts = service.kafkaProceed.lastCall.args[0]
      t.equal(kafkaOpts.messageKey, '789')
      t.equal(kafkaOpts.toDestination, 'dfsp1')
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('_handleReservedAborted Tests -->', methodTest => {
    methodTest.test('should handle reserved aborted notification', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)
      const transfer = {
        transferId: 'test-id',
        payeeFsp: 'dfsp1'
      }
      const apiFSPIOPError = {
        errorInformation: {
          errorCode: '3100',
          errorDescription: 'Test error'
        }
      }

      const transferAbortResult = {
        id: 'test-id',
        completedTimestamp: new Date().toISOString()
      }

      TransferService.getById.resolves(transferAbortResult)
      service.kafkaProceed = sandbox.stub()

      await service._handleReservedAborted(transfer, apiFSPIOPError)

      t.ok(TransferService.getById.calledWith('test-id'))
      t.ok(service.kafkaProceed.calledOnce)
      const kafkaOpts = service.kafkaProceed.lastCall.args[0]
      t.equal(kafkaOpts.eventDetail.action, Action.RESERVED_ABORTED)
      t.equal(kafkaOpts.toDestination, 'dfsp1')
      t.ok(service.params.message.value.content.payload.extensionList)
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.test('kafkaProceed Tests -->', methodTest => {
    methodTest.test('should call Kafka.proceed with correct parameters', async t => {
      const message = fixtures.fulfilKafkaMessageDto()
      const { service } = createFulfilServiceWithTestData(message)

      sandbox.stub(Kafka, 'proceed').resolves()

      const kafkaOpts = {
        consumerCommit: true,
        eventDetail: { functionality: Type.POSITION, action: Action.COMMIT }
      }

      await service.kafkaProceed(kafkaOpts)

      t.ok(Kafka.proceed.calledOnce)
      const [config, , opts] = Kafka.proceed.lastCall.args
      t.deepEqual(config, Config.KAFKA_CONFIG)
      t.equal(opts.hubName, Config.HUB_NAME)
      t.equal(opts.consumerCommit, true)
      t.end()
    })

    methodTest.end()
  })

  fulfilTest.end()
})
