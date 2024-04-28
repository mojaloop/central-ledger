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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

/* eslint-disable object-property-newline */
const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const { Db } = require('@mojaloop/database-lib')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util

const FxFulfilService = require('../../../../src/handlers/transfers/FxFulfilService')
const fspiopErrorFactory = require('../../../../src/shared/fspiopErrorFactory')
const Validator = require('../../../../src/handlers/transfers/validator')
const FxTransferModel = require('../../../../src/models/fxTransfer')
const Config = require('../../../../src/lib/config')
const { ERROR_MESSAGES } = require('../../../../src/shared/constants')
const { Logger } = require('../../../../src/shared/logger')

const fixtures = require('../../../fixtures')
const mocks = require('./mocks')
const { checkErrorPayload } = require('#test/util/helpers')

const { Kafka, Comparators, Hash } = Util
const { Action } = Enum.Events.Event
const { TOPICS } = fixtures

const log = new Logger()
// const functionality = Type.NOTIFICATION

Test('FxFulfilService Tests -->', fxFulfilTest => {
  let sandbox
  let span
  let producer

  const createFxFulfilServiceWithTestData = (message) => {
    const {
      commitRequestId,
      payload,
      type,
      action,
      kafkaTopic
    } = FxFulfilService.decodeKafkaMessage(message)

    const params = {
      message,
      kafkaTopic,
      span,
      decodedPayload: payload,
      consumer: Consumer,
      producer: Producer
    }
    const service = new FxFulfilService({
      log, Config, Comparators, Validator, FxTransferModel, Kafka, params
    })

    return {
      service,
      commitRequestId, payload, type, action
    }
  }

  fxFulfilTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    producer = sandbox.stub(Producer)
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(true)
    sandbox.stub(Db)
    sandbox.stub(FxTransferModel.fxTransfer)
    sandbox.stub(FxTransferModel.duplicateCheck)
    span = mocks.createTracerStub(sandbox).SpanStub
    test.end()
  })

  fxFulfilTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  fxFulfilTest.skip('getDuplicateCheckResult Method Tests -->', methodTest => {
    methodTest.test('should detect duplicate fulfil request [action: fx-commit]', async t => {
      const action = Action.FX_COMMIT
      const metadata = fixtures.fulfilMetadataDto({ action })
      const message = fixtures.fxFulfilKafkaMessageDto({ metadata })
      const {
        service,
        commitRequestId, payload
      } = createFxFulfilServiceWithTestData(message)

      FxTransferModel.duplicateCheck.getFxTransferFulfilmentDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      FxTransferModel.duplicateCheck.saveFxTransferFulfilmentDuplicateCheck.resolves()
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
      const message = fixtures.fxFulfilKafkaMessageDto({ metadata })
      const {
        service,
        commitRequestId, payload
      } = createFxFulfilServiceWithTestData(message)

      FxTransferModel.duplicateCheck.getFxTransferFulfilmentDuplicateCheck.rejects(new Error('Should not be called'))
      FxTransferModel.duplicateCheck.saveFxTransferFulfilmentDuplicateCheck.rejects(new Error('Should not be called'))
      FxTransferModel.duplicateCheck.getFxTransferErrorDuplicateCheck.resolves({ hash: Hash.generateSha256(payload) })
      FxTransferModel.duplicateCheck.saveFxTransferErrorDuplicateCheck.resolves()

      const dupCheckResult = await service.getDuplicateCheckResult({ commitRequestId, payload, action })
      t.ok(dupCheckResult.hasDuplicateId)
      t.ok(dupCheckResult.hasDuplicateHash)
      t.end()
    })

    methodTest.end()
  })

  fxFulfilTest.skip('validateFulfilment Method Tests -->', methodTest => {
    methodTest.test('should pass fulfilment validation', async t => {
      const { service } = createFxFulfilServiceWithTestData(fixtures.fxFulfilKafkaMessageDto())
      const transfer = {
        ilpCondition: fixtures.CONDITION,
        counterPartyFspTargetParticipantCurrencyId: 123
      }
      const payload = { fulfilment: fixtures.FULFILMENT }

      const isOk = await service.validateFulfilment(transfer, payload)
      t.true(isOk)
      t.end()
    })

    methodTest.test('should process wrong fulfilment', async t => {
      Db.getKnex.resolves({
        transaction: sandbox.stub
      })
      FxTransferModel.fxTransfer.saveFxFulfilResponse.restore() // to call real saveFxFulfilResponse impl.

      const { service } = createFxFulfilServiceWithTestData(fixtures.fxFulfilKafkaMessageDto())
      const transfer = {
        ilpCondition: fixtures.CONDITION,
        counterPartyFspTargetParticipantCurrencyId: 123
      }
      const payload = { fulfilment: 'wrongFulfilment' }

      try {
        await service.validateFulfilment(transfer, payload)
        t.fail('Should throw fxInvalidFulfilment error')
      } catch (err) {
        t.equal(err.message, ERROR_MESSAGES.fxInvalidFulfilment)
        t.ok(producer.produceMessage.calledOnce)
        const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
        t.equal(topicConfig.topicName, TOPICS.transferPosition)
        t.equal(topicConfig.key, String(transfer.counterPartyFspTargetParticipantCurrencyId))
        t.equal(messageProtocol.from, fixtures.FXP_ID)
        t.equal(messageProtocol.to, fixtures.DFSP1_ID)
        t.equal(messageProtocol.metadata.event.action, Action.FX_ABORT_VALIDATION)
        checkErrorPayload(t)(messageProtocol.content.payload, fspiopErrorFactory.fxInvalidFulfilment())
      }
      t.end()
    })

    methodTest.end()
  })

  fxFulfilTest.end()
})
