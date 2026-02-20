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
const { Enum } = require('@mojaloop/central-services-shared')
const GetService = require('../../../../src/handlers/transfers/GetService')
const facade = require('../../../../src/models/participant/facade')

const { TransferState } = Enum.Transfers
const { Type, Action } = Enum.Events.Event

Test('GetService Tests -->', getServiceTest => {
  let sandbox
  let getService
  let mockDeps
  let mockTransfer
  let mockTransferError

  getServiceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    mockTransfer = {
      transferId: 'transfer-123',
      payerFsp: 'payer-fsp',
      payeeFsp: 'payee-fsp',
      externalPayerName: null,
      transferStateEnumeration: TransferState.COMMITTED,
      amount: { amount: '100', currency: 'USD' }
    }

    mockTransferError = {
      errorCode: '5001',
      errorDescription: 'Transfer error',
      extensionList: null
    }

    mockDeps = {
      log: {
        debug: sandbox.stub(),
        info: sandbox.stub(),
        warn: sandbox.stub(),
        error: sandbox.stub()
      },
      Config: {
        ERROR_HANDLING: { includeCauseExtension: false },
        KAFKA_CONFIG: {},
        HUB_NAME: 'test-hub'
      },
      Validator: {
        validateParticipantByName: sandbox.stub(),
        validateParticipantTransferId: sandbox.stub()
      },
      TransferService: {
        getByIdLight: sandbox.stub(),
        getById: sandbox.stub()
      },
      Participant: {},
      Kafka: {
        proceed: sandbox.stub()
      },
      params: { message: { value: { content: { payload: {} } } } },
      externalParticipantCached: {
        getByName: sandbox.stub()
      },
      TransferErrorModel: {
        getByTransferId: sandbox.stub()
      },
      transform: {
        toFulfil: sandbox.stub()
      },
      ProxyCache: {
        addDfspProxyMapping: sandbox.stub()
      }
    }

    sandbox.stub(facade, 'getExternalParticipantIdByNameOrCreate')
    getService = new GetService(mockDeps)
    test.end()
  })

  getServiceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  getServiceTest.test('constructor Tests -->', constructorTest => {
    constructorTest.test('should initialize with provided dependencies', async t => {
      t.equal(getService.log, mockDeps.log)
      t.equal(getService.Config, mockDeps.Config)
      t.equal(getService.Validator, mockDeps.Validator)
      t.equal(getService.TransferService, mockDeps.TransferService)
      t.equal(getService.Kafka, mockDeps.Kafka)
      t.end()
    })

    constructorTest.test('should use default transform if not provided', async t => {
      const depsWithoutTransform = { ...mockDeps }
      delete depsWithoutTransform.transform
      const service = new GetService(depsWithoutTransform)
      t.ok(service.transform)
      t.end()
    })

    constructorTest.end()
  })

  getServiceTest.test('getTransferDetails Tests -->', methodTest => {
    methodTest.test('should return transfer when found', async t => {
      mockDeps.TransferService.getByIdLight.resolves(mockTransfer)

      const result = await getService.getTransferDetails('transfer-123', Type.NOTIFICATION)

      t.ok(mockDeps.TransferService.getByIdLight.calledWith('transfer-123'))
      t.deepEqual(result, mockTransfer)
      t.end()
    })

    methodTest.test('should throw error and send Kafka message when transfer not found', async t => {
      mockDeps.TransferService.getByIdLight.resolves(null)
      mockDeps.Kafka.proceed.resolves()

      try {
        await getService.getTransferDetails('transfer-123', Type.NOTIFICATION)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(mockDeps.log.warn.calledWith(
          'transfer not found',
          Sinon.match({
            transferId: 'transfer-123',
            eventDetail: {
              functionality: Type.NOTIFICATION,
              action: Action.GET
            }
          })
        ))
        t.ok(mockDeps.Kafka.proceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('getProxiedTransferDetails Tests -->', methodTest => {
    methodTest.test('should return detailed transfer information for proxied get', async t => {
      const detailedTransfer = { ...mockTransfer, additionalDetails: 'details' }
      mockDeps.TransferService.getById.resolves(detailedTransfer)

      const result = await getService.getProxiedTransferDetails('transfer-123')

      t.ok(mockDeps.TransferService.getById.calledWith('transfer-123'))
      t.deepEqual(result, detailedTransfer)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('validateParticipant Tests -->', methodTest => {
    methodTest.test('should return true when participant is valid for non-proxied get', async t => {
      mockDeps.Validator.validateParticipantByName.resolves(true)

      const result = await getService.validateParticipant('payer-fsp', false)

      t.ok(mockDeps.Validator.validateParticipantByName.calledWith('payer-fsp'))
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should return true for proxied get without validation', async t => {
      const result = await getService.validateParticipant('payer-fsp', true)

      t.ok(mockDeps.Validator.validateParticipantByName.notCalled)
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should return false and send Kafka message when participant is invalid', async t => {
      mockDeps.Validator.validateParticipantByName.resolves(false)
      mockDeps.Kafka.proceed.resolves()

      const result = await getService.validateParticipant('invalid-fsp', false)

      t.equal(result, false)
      t.ok(mockDeps.log.info.calledWith('breakParticipantDoesntExist--G1'))
      t.ok(mockDeps.Kafka.proceed.calledOnce)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('validateParticipantTransfer Tests -->', methodTest => {
    methodTest.test('should pass validation for valid participant and transfer', async t => {
      mockDeps.Validator.validateParticipantTransferId.resolves(true)

      await getService.validateParticipantTransfer('payer-fsp', 'transfer-123', false)

      t.ok(mockDeps.Validator.validateParticipantTransferId
        .calledWith('payer-fsp', 'transfer-123'))
      t.end()
    })

    methodTest.test('should skip validation for proxied get', async t => {
      await getService.validateParticipantTransfer('payer-fsp', 'transfer-123', true)

      t.ok(mockDeps.Validator.validateParticipantTransferId.notCalled)
      t.end()
    })

    methodTest.test('should throw error when participant transfer validation fails', async t => {
      mockDeps.Validator.validateParticipantTransferId.resolves(false)
      mockDeps.Kafka.proceed.resolves()

      try {
        await getService.validateParticipantTransfer('invalid-fsp', 'transfer-123', false)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(mockDeps.log.warn.calledWith(
          'callbackErrorGeneric',
          Sinon.match({
            eventDetail: {
              functionality: Type.NOTIFICATION,
              action: Action.GET
            }
          })
        ))
        t.ok(mockDeps.Kafka.proceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('validateNotFoundError Tests -->', methodTest => {
    methodTest.test('should create external participant for proxied get and throw error', async t => {
      const proxy = { id: 'proxy-id' }
      facade.getExternalParticipantIdByNameOrCreate.resolves()
      mockDeps.ProxyCache.addDfspProxyMapping.resolves()
      mockDeps.Kafka.proceed.resolves()

      try {
        await getService.validateNotFoundError('transfer-123', Type.NOTIFICATION, true, proxy, 'source-hub')
        t.fail('Should throw error')
      } catch (err) {
        t.ok(facade.getExternalParticipantIdByNameOrCreate
          .calledWith({ name: 'source-hub', proxyId: proxy }))
        t.ok(mockDeps.log.warn.calledWith(
          'callbackErrorTransferNotFound',
          Sinon.match({ transferId: 'transfer-123' })
        ))
      }
      t.end()
    })

    methodTest.test('should throw error without creating external participant for non-proxied get', async t => {
      mockDeps.Kafka.proceed.resolves()

      try {
        await getService.validateNotFoundError('transfer-123', Type.NOTIFICATION, false, null, 'participant')
        t.fail('Should throw error')
      } catch (err) {
        t.ok(facade.getExternalParticipantIdByNameOrCreate.notCalled)
        t.ok(mockDeps.log.warn.calledWith('callbackErrorTransferNotFound', Sinon.match.any))
      }
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('shouldReplyWithErrorCallback Tests -->', methodTest => {
    methodTest.test('should return false for committed transfer', async t => {
      const transfer = { transferStateEnumeration: TransferState.COMMITTED }
      t.equal(getService.shouldReplyWithErrorCallback(transfer), false)
      t.end()
    })

    methodTest.test('should return false for reserved transfer', async t => {
      const transfer = { transferStateEnumeration: TransferState.RESERVED }
      t.equal(getService.shouldReplyWithErrorCallback(transfer), false)
      t.end()
    })

    methodTest.test('should return false for settled transfer', async t => {
      const transfer = { transferStateEnumeration: TransferState.SETTLED }
      t.equal(getService.shouldReplyWithErrorCallback(transfer), false)
      t.end()
    })

    methodTest.test('should return true for failed transfer', async t => {
      const transfer = { transferStateEnumeration: TransferState.ABORTED }
      t.equal(getService.shouldReplyWithErrorCallback(transfer), true)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('handleErrorCallback Tests -->', methodTest => {
    const transfer = {
      externalPayerName: null,
      payerFsp: 'payer-fsp'
    }

    methodTest.test('should handle error callback with existing transfer error', async t => {
      mockDeps.TransferErrorModel.getByTransferId.resolves(mockTransferError)
      mockDeps.Kafka.proceed.resolves()

      const result = await getService.handleErrorCallback(transfer, 'transfer-123', Type.NOTIFICATION)

      t.ok(mockDeps.TransferErrorModel.getByTransferId.calledWith('transfer-123'))
      t.ok(mockDeps.log.warn.calledWith(
        'callbackErrorGeneric',
        Sinon.match({
          transferId: 'transfer-123',
          eventDetail: {
            functionality: Type.NOTIFICATION,
            action: Action.TIMEOUT_RECEIVED
          }
        })
      ))
      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'payer-fsp'
        })
      ))
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should handle error callback without existing transfer error', async t => {
      mockDeps.TransferErrorModel.getByTransferId.resolves(null)
      mockDeps.Kafka.proceed.resolves()

      const result = await getService.handleErrorCallback(transfer, 'transfer-123', Type.NOTIFICATION)

      t.equal(result, true)
      t.end()
    })

    methodTest.test('should use externalPayerName if available', async t => {
      const transferWithExternal = {
        ...transfer,
        externalPayerName: 'external-payer'
      }
      mockDeps.TransferErrorModel.getByTransferId.resolves(mockTransferError)
      mockDeps.Kafka.proceed.resolves()

      await getService.handleErrorCallback(transferWithExternal, 'transfer-123', Type.NOTIFICATION)

      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'external-payer'
        })
      ))
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('createTransferPayload Tests -->', methodTest => {
    methodTest.test('should transform transfer to fulfil format', async t => {
      const expectedPayload = { fulfil: 'data' }
      mockDeps.transform.toFulfil.returns(expectedPayload)

      const result = getService.createTransferPayload(mockTransfer)

      t.ok(mockDeps.transform.toFulfil.calledWith(mockTransfer))
      t.deepEqual(result, expectedPayload)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('handleProxiedGetSuccess Tests -->', methodTest => {
    methodTest.test('should send success message for proxied get', async t => {
      const transfer = { payerFsp: 'payer-fsp' }
      mockDeps.Kafka.proceed.resolves()

      await getService.handleProxiedGetSuccess(transfer, 'transfer-123')

      t.ok(mockDeps.log.info.calledWith(
        'callbackMessage (proxied)',
        {
          transferId: 'transfer-123',
          eventDetail: {
            functionality: Type.NOTIFICATION,
            action: Action.GET
          }
        }
      ))
      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'payer-fsp'
        })
      ))
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('handleStandardGetSuccess Tests -->', methodTest => {
    methodTest.test('should send success message for standard get', async t => {
      const eventDetail = {
        functionality: Type.NOTIFICATION,
        action: Action.GET
      }
      mockDeps.Kafka.proceed.resolves()

      await getService.handleStandardGetSuccess(eventDetail)

      t.ok(mockDeps.log.info.calledWith('callbackMessage (standard)', { eventDetail }))
      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          hubName: mockDeps.Config.HUB_NAME
        })
      ))
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('kafkaProceed Tests -->', methodTest => {
    methodTest.test('should call Kafka proceed with correct parameters', async t => {
      const kafkaOpts = { consumerCommit: true }
      mockDeps.Kafka.proceed.resolves()

      await getService.kafkaProceed(kafkaOpts)

      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        {
          ...kafkaOpts,
          hubName: mockDeps.Config.HUB_NAME
        }
      ))
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('isProxiedGet Tests -->', methodTest => {
    methodTest.test('should return true when FSPIOP proxy header is present', async t => {
      const headers = {
        [Enum.Http.Headers.FSPIOP.PROXY]: 'some-proxy'
      }
      t.equal(getService.isProxiedGet(headers), true)
      t.end()
    })

    methodTest.test('should return null when headers is null', async t => {
      t.equal(getService.isProxiedGet(null), null)
      t.end()
    })

    methodTest.test('should return null when FSPIOP proxy header is not present', async t => {
      const headers = { 'other-header': 'value' }
      t.equal(getService.isProxiedGet(headers), null)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('getExternalParticipant Tests -->', methodTest => {
    methodTest.test('should return external participant when destination is provided', async t => {
      const mockParticipant = { id: 1, name: 'external-participant' }
      mockDeps.externalParticipantCached.getByName.resolves(mockParticipant)

      const result = await getService.getExternalParticipant('external-participant')

      t.ok(mockDeps.externalParticipantCached.getByName
        .calledWith('external-participant'))
      t.deepEqual(result, mockParticipant)
      t.end()
    })

    methodTest.test('should return null when destination is not provided', async t => {
      const result = await getService.getExternalParticipant(null)

      t.ok(mockDeps.externalParticipantCached.getByName.notCalled)
      t.equal(result, null)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.test('getActionLetter Tests -->', methodTest => {
    methodTest.test('should return correct action letters for FX actions', async t => {
      t.equal(getService.getActionLetter(Action.FX_COMMIT),
        Enum.Events.ActionLetter.fxCommit)
      t.equal(getService.getActionLetter(Action.FX_RESERVE),
        Enum.Events.ActionLetter.fxReserve)
      t.equal(getService.getActionLetter(Action.FX_REJECT),
        Enum.Events.ActionLetter.fxReject)
      t.equal(getService.getActionLetter(Action.FX_ABORT),
        Enum.Events.ActionLetter.fxAbort)
      t.equal(getService.getActionLetter(Action.FX_FORWARDED),
        Enum.Events.ActionLetter.fxForwarded)
      t.end()
    })

    methodTest.test('should return unknown for unrecognized action', async t => {
      t.equal(getService.getActionLetter('UNKNOWN_ACTION'),
        Enum.Events.ActionLetter.unknown)
      t.end()
    })

    methodTest.end()
  })

  getServiceTest.end()
})
