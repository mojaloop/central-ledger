/* eslint-disable object-property-newline */
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const FxFulfilService = require('../../../../src/handlers/transfers/FxFulfilService')
const Validator = require('../../../../src/handlers/transfers/validator')
const FxTransferModel = require('../../../../src/models/fxTransfer')
const Config = require('../../../../src/lib/config')
const { Logger } = require('../../../../src/shared/logger')

const fixtures = require('../../../fixtures')
const mocks = require('./mocks')

const { Kafka, Comparators, Hash } = Util
const { Action } = Enum.Events.Event

const log = new Logger()
// const functionality = Type.NOTIFICATION

Test('FxFulfilService Tests -->', fxFulfilTest => {
  let sandbox
  let span

  const createFxFulfilServiceWithTestData = (message) => {
    const {
      commitRequestId,
      payload,
      type,
      action,
      kafkaTopic
    } = FxFulfilService.decodeKafkaMessage(message)

    const kafkaParams = {
      message,
      kafkaTopic,
      span,
      decodedPayload: payload,
      consumer: Consumer,
      producer: Producer
    }
    const service = new FxFulfilService({
      log, Config, Comparators, Validator, FxTransferModel, Kafka, kafkaParams
    })

    return {
      service,
      commitRequestId, payload, type, action
    }
  }

  fxFulfilTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(FxTransferModel.duplicateCheck)
    span = mocks.createTracerStub(sandbox).SpanStub
    // producer = sandbox.stub(Producer)
    test.end()
  })

  fxFulfilTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  fxFulfilTest.test('getDuplicateCheckResult Method Tests -->', methodTest => {
    methodTest.test('should detect duplicate fulfil request [action: fx-commit]', async t => {
      const action = Action.FX_COMMIT
      const metadata = fixtures.fulfilMetadataDto({ action })
      const message = fixtures.fulfilKafkaMessageDto({ metadata })
      const {
        service,
        commitRequestId, payload
      } = createFxFulfilServiceWithTestData(message)

      FxTransferModel.duplicateCheck.getFxTransferDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      FxTransferModel.duplicateCheck.saveFxTransferDuplicateCheck.resolves()
      FxTransferModel.duplicateCheck.getFxTransferErrorDuplicateCheck.rejects(new Error('Should not be called'))
      FxTransferModel.duplicateCheck.saveFxTransferErrorDuplicateCheck.rejects(new Error('Should not be called'))

      const dupCheckResult = await service.getDuplicateCheckResult({ commitRequestId, payload, action })
      t.ok(dupCheckResult.hasDuplicateId)
      t.ok(dupCheckResult.hasDuplicateHash)
      t.end()
    })

    methodTest.test('should detect error duplicate fulfil request [action: fx-abort]', async t => {
      const action = Action.FX_ABORT
      const metadata = fixtures.fulfilMetadataDto({ action })
      const message = fixtures.fulfilKafkaMessageDto({ metadata })
      const {
        service,
        commitRequestId, payload
      } = createFxFulfilServiceWithTestData(message)

      FxTransferModel.duplicateCheck.getFxTransferDuplicateCheck.rejects(new Error('Should not be called'))
      FxTransferModel.duplicateCheck.saveFxTransferDuplicateCheck.rejects(new Error('Should not be called'))
      FxTransferModel.duplicateCheck.getFxTransferErrorDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      FxTransferModel.duplicateCheck.saveFxTransferErrorDuplicateCheck.resolves()

      const dupCheckResult = await service.getDuplicateCheckResult({ commitRequestId, payload, action })
      t.ok(dupCheckResult.hasDuplicateId)
      t.ok(dupCheckResult.hasDuplicateHash)
      t.end()
    })

    methodTest.end()
  })

  fxFulfilTest.end()
})
