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
const FxGetService = require('../../../../src/handlers/transfers/FxGetService')
const facade = require('../../../../src/models/participant/facade')

const { TransferState } = Enum.Transfers
const { Type, Action } = Enum.Events.Event

Test('FxGetService Tests -->', fxGetServiceTest => {
  let sandbox
  let fxGetService
  let mockDeps
  let mockFxTransfer
  let mockFxTransferError

  fxGetServiceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()

    mockFxTransfer = {
      commitRequestId: 'commit-123',
      initiatingFspName: 'initiator-fsp',
      counterPartyFspName: 'counter-fsp',
      externalInitiatingFspName: null,
      transferStateEnumeration: TransferState.COMMITTED,
      sourceAmount: { amount: '100', currency: 'USD' },
      targetAmount: { amount: '80', currency: 'EUR' }
    }

    mockFxTransferError = {
      errorCode: '5001',
      errorDescription: 'FX Transfer error',
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
        validateParticipantForCommitRequestId: sandbox.stub()
      },
      FxTransferModel: {
        fxTransfer: {
          getByIdLight: sandbox.stub(),
          getAllDetailsByCommitRequestId: sandbox.stub()
        }
      },
      Participant: {},
      Kafka: {
        proceed: sandbox.stub()
      },
      params: { message: { value: { content: { payload: {} } } } },
      externalParticipantCached: {
        getByName: sandbox.stub()
      },
      FxTransferErrorModel: {
        getByCommitRequestId: sandbox.stub()
      },
      transform: {
        toFulfil: sandbox.stub()
      }
    }

    sandbox.stub(facade, 'getExternalParticipantIdByNameOrCreate')
    fxGetService = new FxGetService(mockDeps)
    test.end()
  })

  fxGetServiceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  fxGetServiceTest.test('constructor Tests -->', constructorTest => {
    constructorTest.test('should initialize with provided dependencies', async t => {
      t.equal(fxGetService.log, mockDeps.log)
      t.equal(fxGetService.Config, mockDeps.Config)
      t.equal(fxGetService.Validator, mockDeps.Validator)
      t.equal(fxGetService.FxTransferModel, mockDeps.FxTransferModel)
      t.equal(fxGetService.Kafka, mockDeps.Kafka)
      t.end()
    })

    constructorTest.test('should use default transform if not provided', async t => {
      const depsWithoutTransform = { ...mockDeps }
      delete depsWithoutTransform.transform
      const service = new FxGetService(depsWithoutTransform)
      t.ok(service.transform)
      t.end()
    })

    constructorTest.end()
  })

  fxGetServiceTest.test('getFxTransferDetails Tests -->', methodTest => {
    methodTest.test('should return fx transfer when found', async t => {
      mockDeps.FxTransferModel.fxTransfer.getByIdLight.resolves(mockFxTransfer)

      const result = await fxGetService.getFxTransferDetails('commit-123', Type.NOTIFICATION)

      t.ok(mockDeps.FxTransferModel.fxTransfer.getByIdLight.calledWith('commit-123'))
      t.deepEqual(result, mockFxTransfer)
      t.end()
    })

    methodTest.test('should throw error and send Kafka message when fx transfer not found', async t => {
      mockDeps.FxTransferModel.fxTransfer.getByIdLight.resolves(null)
      mockDeps.Kafka.proceed.resolves()

      try {
        await fxGetService.getFxTransferDetails('commit-123', Type.NOTIFICATION)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(mockDeps.log.warn.calledWith(
          'fxTransfer not found',
          Sinon.match({
            commitRequestId: 'commit-123',
            eventDetail: {
              functionality: Type.NOTIFICATION,
              action: Action.FX_GET
            }
          })
        ))
        t.ok(mockDeps.Kafka.proceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('getProxiedFxTransferDetails Tests -->', methodTest => {
    methodTest.test('should return detailed fx transfer information for proxied get', async t => {
      const detailedFxTransfer = { ...mockFxTransfer, additionalDetails: 'details' }
      mockDeps.FxTransferModel.fxTransfer.getAllDetailsByCommitRequestId.resolves(detailedFxTransfer)

      const result = await fxGetService.getProxiedFxTransferDetails('commit-123')

      t.ok(mockDeps.FxTransferModel.fxTransfer.getAllDetailsByCommitRequestId
        .calledWith('commit-123'))
      t.deepEqual(result, detailedFxTransfer)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('validateParticipant Tests -->', methodTest => {
    methodTest.test('should return true when participant is valid for non-proxied get', async t => {
      mockDeps.Validator.validateParticipantByName.resolves(true)

      const result = await fxGetService.validateParticipant('initiator-fsp', false)

      t.ok(mockDeps.Validator.validateParticipantByName.calledWith('initiator-fsp'))
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should return true for proxied get without validation', async t => {
      const result = await fxGetService.validateParticipant('initiator-fsp', true)

      t.ok(mockDeps.Validator.validateParticipantByName.notCalled)
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should return false and send Kafka message when participant is invalid', async t => {
      mockDeps.Validator.validateParticipantByName.resolves(false)
      mockDeps.Kafka.proceed.resolves()

      const result = await fxGetService.validateParticipant('invalid-fsp', false)

      t.equal(result, false)
      t.ok(mockDeps.log.info.calledWith('breakParticipantDoesntExist--G1'))
      t.ok(mockDeps.Kafka.proceed.calledOnce)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('validateParticipantCommitRequest Tests -->', methodTest => {
    methodTest.test('should pass validation for valid participant and commit request', async t => {
      mockDeps.Validator.validateParticipantForCommitRequestId.resolves(true)

      await fxGetService.validateParticipantCommitRequest('initiator-fsp', 'commit-123', false)

      t.ok(mockDeps.Validator.validateParticipantForCommitRequestId
        .calledWith('initiator-fsp', 'commit-123'))
      t.end()
    })

    methodTest.test('should skip validation for proxied get', async t => {
      await fxGetService.validateParticipantCommitRequest('initiator-fsp', 'commit-123', true)

      t.ok(mockDeps.Validator.validateParticipantForCommitRequestId.notCalled)
      t.end()
    })

    methodTest.test('should throw error when participant commit request validation fails', async t => {
      mockDeps.Validator.validateParticipantForCommitRequestId.resolves(false)
      mockDeps.Kafka.proceed.resolves()

      try {
        await fxGetService.validateParticipantCommitRequest('invalid-fsp', 'commit-123', false)
        t.fail('Should throw error')
      } catch (err) {
        t.ok(mockDeps.log.warn.calledWith(
          'callbackErrorGeneric',
          Sinon.match({
            eventDetail: {
              functionality: Type.NOTIFICATION,
              action: Action.FX_GET
            }
          })
        ))
        t.ok(mockDeps.Kafka.proceed.calledOnce)
      }
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('validateNotFoundError Tests -->', methodTest => {
    methodTest.test('should create external participant for proxied get and throw error', async t => {
      const proxy = { id: 'proxy-id' }
      facade.getExternalParticipantIdByNameOrCreate.resolves()
      mockDeps.Kafka.proceed.resolves()

      try {
        await fxGetService.validateNotFoundError('commit-123', Type.NOTIFICATION, true, proxy, 'source-hub')
        t.fail('Should throw error')
      } catch (err) {
        t.ok(facade.getExternalParticipantIdByNameOrCreate
          .calledWith({ name: 'source-hub', proxyId: proxy }))
        t.ok(mockDeps.log.warn.calledWith(
          'callbackErrorFxTransferNotFound',
          Sinon.match({ commitRequestId: 'commit-123' })
        ))
      }
      t.end()
    })

    methodTest.test('should throw error without creating external participant for non-proxied get', async t => {
      mockDeps.Kafka.proceed.resolves()

      try {
        await fxGetService.validateNotFoundError('commit-123', Type.NOTIFICATION, false, null, 'participant')
        t.fail('Should throw error')
      } catch (err) {
        t.ok(facade.getExternalParticipantIdByNameOrCreate.notCalled)
        t.ok(mockDeps.log.warn.calledWith('callbackErrorFxTransferNotFound', Sinon.match.any))
      }
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('shouldReplyWithErrorCallback Tests -->', methodTest => {
    methodTest.test('should return false for committed fx transfer', async t => {
      const fxTransfer = { transferStateEnumeration: TransferState.COMMITTED }
      t.equal(fxGetService.shouldReplyWithErrorCallback(fxTransfer), false)
      t.end()
    })

    methodTest.test('should return false for reserved fx transfer', async t => {
      const fxTransfer = { transferStateEnumeration: TransferState.RESERVED }
      t.equal(fxGetService.shouldReplyWithErrorCallback(fxTransfer), false)
      t.end()
    })

    methodTest.test('should return false for settled fx transfer', async t => {
      const fxTransfer = { transferStateEnumeration: TransferState.SETTLED }
      t.equal(fxGetService.shouldReplyWithErrorCallback(fxTransfer), false)
      t.end()
    })

    methodTest.test('should return true for failed fx transfer', async t => {
      const fxTransfer = { transferStateEnumeration: TransferState.ABORTED }
      t.equal(fxGetService.shouldReplyWithErrorCallback(fxTransfer), true)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('handleErrorCallback Tests -->', methodTest => {
    const fxTransfer = {
      externalInitiatingFspName: null,
      initiatingFspName: 'initiator-fsp'
    }

    methodTest.test('should handle error callback with existing fx transfer error', async t => {
      mockDeps.FxTransferErrorModel.getByCommitRequestId.resolves(mockFxTransferError)
      mockDeps.Kafka.proceed.resolves()

      const result = await fxGetService.handleErrorCallback(fxTransfer, 'commit-123', Type.NOTIFICATION)

      t.ok(mockDeps.FxTransferErrorModel.getByCommitRequestId.calledWith('commit-123'))
      t.ok(mockDeps.log.warn.calledWith(
        'callbackErrorGeneric',
        Sinon.match({
          commitRequestId: 'commit-123',
          eventDetail: {
            functionality: Type.NOTIFICATION,
            action: Action.FX_TIMEOUT_RECEIVED
          }
        })
      ))
      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'initiator-fsp'
        })
      ))
      t.equal(result, true)
      t.end()
    })

    methodTest.test('should handle error callback without existing fx transfer error', async t => {
      mockDeps.FxTransferErrorModel.getByCommitRequestId.resolves(null)
      mockDeps.Kafka.proceed.resolves()

      const result = await fxGetService.handleErrorCallback(fxTransfer, 'commit-123', Type.NOTIFICATION)

      t.equal(result, true)
      t.end()
    })

    methodTest.test('should use externalInitiatingFspName if available', async t => {
      const fxTransferWithExternal = {
        ...fxTransfer,
        externalInitiatingFspName: 'external-initiator'
      }
      mockDeps.FxTransferErrorModel.getByCommitRequestId.resolves(mockFxTransferError)
      mockDeps.Kafka.proceed.resolves()

      await fxGetService.handleErrorCallback(fxTransferWithExternal, 'commit-123', Type.NOTIFICATION)

      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'external-initiator'
        })
      ))
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('createFxTransferPayload Tests -->', methodTest => {
    methodTest.test('should transform fx transfer to fulfil format', async t => {
      const expectedPayload = { fulfil: 'data' }
      mockDeps.transform.toFulfil.returns(expectedPayload)

      const result = fxGetService.createFxTransferPayload(mockFxTransfer)

      t.ok(mockDeps.transform.toFulfil.calledWith(mockFxTransfer, true))
      t.deepEqual(result, expectedPayload)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('handleProxiedGetSuccess Tests -->', methodTest => {
    methodTest.test('should send success message for proxied get', async t => {
      const fxTransfer = { initiatingFspName: 'initiator-fsp' }
      mockDeps.Kafka.proceed.resolves()

      await fxGetService.handleProxiedGetSuccess(fxTransfer, 'commit-123')

      t.ok(mockDeps.log.info.calledWith(
        'callbackMessage (proxied)',
        {
          commitRequestId: 'commit-123',
          eventDetail: {
            functionality: Type.NOTIFICATION,
            action: Action.FX_GET
          }
        }
      ))
      t.ok(mockDeps.Kafka.proceed.calledWith(
        mockDeps.Config.KAFKA_CONFIG,
        mockDeps.params,
        Sinon.match({
          toDestination: 'initiator-fsp'
        })
      ))
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('handleStandardGetSuccess Tests -->', methodTest => {
    methodTest.test('should send success message for standard get', async t => {
      const eventDetail = {
        functionality: Type.NOTIFICATION,
        action: Action.FX_GET
      }
      mockDeps.Kafka.proceed.resolves()

      await fxGetService.handleStandardGetSuccess(eventDetail)

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

  fxGetServiceTest.test('kafkaProceed Tests -->', methodTest => {
    methodTest.test('should call Kafka proceed with correct parameters', async t => {
      const kafkaOpts = { consumerCommit: true }
      mockDeps.Kafka.proceed.resolves()

      await fxGetService.kafkaProceed(kafkaOpts)

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

  fxGetServiceTest.test('isProxiedGet Tests -->', methodTest => {
    methodTest.test('should return true when FSPIOP proxy header is present', async t => {
      const headers = {
        [Enum.Http.Headers.FSPIOP.PROXY]: 'some-proxy'
      }
      t.equal(fxGetService.isProxiedGet(headers), true)
      t.end()
    })

    methodTest.test('should return null when headers is null', async t => {
      t.equal(fxGetService.isProxiedGet(null), null)
      t.end()
    })

    methodTest.test('should return null when FSPIOP proxy header is not present', async t => {
      const headers = { 'other-header': 'value' }
      t.equal(fxGetService.isProxiedGet(headers), null)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('getExternalParticipant Tests -->', methodTest => {
    methodTest.test('should return external participant when destination is provided', async t => {
      const mockParticipant = { id: 1, name: 'external-participant' }
      mockDeps.externalParticipantCached.getByName.resolves(mockParticipant)

      const result = await fxGetService.getExternalParticipant('external-participant')

      t.ok(mockDeps.externalParticipantCached.getByName
        .calledWith('external-participant'))
      t.deepEqual(result, mockParticipant)
      t.end()
    })

    methodTest.test('should return null when destination is not provided', async t => {
      const result = await fxGetService.getExternalParticipant(null)

      t.ok(mockDeps.externalParticipantCached.getByName.notCalled)
      t.equal(result, null)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.test('getActionLetter Tests -->', methodTest => {
    methodTest.test('should return correct action letters for FX actions', async t => {
      t.equal(fxGetService.getActionLetter(Action.FX_COMMIT),
        Enum.Events.ActionLetter.fxCommit)
      t.equal(fxGetService.getActionLetter(Action.FX_RESERVE),
        Enum.Events.ActionLetter.fxReserve)
      t.equal(fxGetService.getActionLetter(Action.FX_REJECT),
        Enum.Events.ActionLetter.fxReject)
      t.equal(fxGetService.getActionLetter(Action.FX_ABORT),
        Enum.Events.ActionLetter.fxAbort)
      t.equal(fxGetService.getActionLetter(Action.FX_FORWARDED),
        Enum.Events.ActionLetter.fxForwarded)
      t.end()
    })

    methodTest.test('should return unknown for unrecognized action', async t => {
      t.equal(fxGetService.getActionLetter('UNKNOWN_ACTION'),
        Enum.Events.ActionLetter.unknown)
      t.end()
    })

    methodTest.end()
  })

  fxGetServiceTest.end()
})
