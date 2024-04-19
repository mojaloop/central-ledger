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
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Deon Botha <deon.botha@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>

 --------------
 ******/
'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Proxyquire = require('proxyquire')

const { Util, Enum } = require('@mojaloop/central-services-shared')
const { Consumer, Producer } = require('@mojaloop/central-services-stream').Util
const { FSPIOPError } = require('@mojaloop/central-services-error-handling').Factory

const FxFulfilService = require('../../../../src/handlers/transfers/FxFulfilService')
const fxTransferModel = require('../../../../src/models/fxTransfer')
const Validator = require('../../../../src/handlers/transfers/validator')
const TransferObjectTransform = require('../../../../src/domain/transfer/transform')
const fspiopErrorFactory = require('../../../../src/shared/fspiopErrorFactory')
const { ERROR_HANDLING } = require('../../../../src/lib/config')
const { logger } = require('../../../../src/shared/logger')

const fixtures = require('../../../fixtures')
const mocks = require('./mocks')

const { Kafka, Comparators } = Util
const { Action } = Enum.Events.Event
const { TransferState } = Enum.Transfers

const TOPICS = Object.freeze({
  notificationEvent: 'topic-notification-event',
  transferPosition: 'topic-transfer-position'
})
// think, how to define TOPICS dynamically (based on TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE)

let transferHandlers

Test('FX Transfer Fulfil handler -->', fxFulfilTest => {
  let sandbox
  let producer

  fxFulfilTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    producer = sandbox.stub(Producer)

    const { TracerStub } = mocks.createTracerStub(sandbox)
    const EventSdkStub = {
      Tracer: TracerStub
    }
    transferHandlers = Proxyquire('../../../../src/handlers/transfers/handler', {
      '@mojaloop/event-sdk': EventSdkStub
    })

    sandbox.stub(Comparators)
    sandbox.stub(Validator)
    sandbox.stub(fxTransferModel.fxTransfer)
    sandbox.stub(fxTransferModel.watchList)
    sandbox.stub(TransferObjectTransform, 'toFulfil')
    sandbox.stub(Consumer, 'getConsumer').returns({
      commitMessageSync: async () => true
    })
    sandbox.stub(Consumer, 'isConsumerAutoCommitEnabled').returns(false)
    test.end()
  })

  fxFulfilTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  const compareFspiopError = test => (actualErrorPayload, expectedFspiopError) => {
    if (!(expectedFspiopError instanceof FSPIOPError)) {
      throw new TypeError('Not a FSPIOPError')
    }
    const { errorCode, errorDescription } = expectedFspiopError.toApiErrorObject(ERROR_HANDLING).errorInformation
    test.equal(actualErrorPayload.errorInformation.errorCode, errorCode)
    test.equal(actualErrorPayload.errorInformation.errorDescription, errorDescription)
  }

  fxFulfilTest.test('should return true in case of wrong message format', async (test) => {
    const logError = sandbox.stub(logger, 'error')
    const result = await transferHandlers.fulfil(null, {})
    test.ok(result)
    test.ok(logError.calledOnce)
    test.ok(logError.lastCall.firstArg.includes("Cannot read properties of undefined (reading 'metadata')"))
    test.end()
  })

  fxFulfilTest.test('commitRequestId not found -->', async (test) => {
    const from = fixtures.DFSP1_ID
    const to = fixtures.DFSP2_ID
    const notFoundError = fspiopErrorFactory.fxTransferNotFound()
    let message

    test.beforeEach((t) => {
      message = fixtures.fulfilKafkaMessageDto({
        from,
        to,
        metadata: fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
      })
      fxTransferModel.fxTransfer.getByIdLight.resolves(null)
      t.end()
    })

    test.test('should call Kafka.proceed with proper fspiopError', async (t) => {
      sandbox.stub(Kafka, 'proceed')
      const result = await transferHandlers.fulfil(null, message)

      t.ok(result)
      t.ok(Kafka.proceed.calledOnce)
      const [, params, opts] = Kafka.proceed.lastCall.args
      t.equal(params.message, message)
      t.equal(params.kafkaTopic, message.topic)
      t.deepEqual(opts.eventDetail, {
        functionality: 'notification',
        action: Action.FX_RESERVE
      })
      t.true(opts.fromSwitch)
      compareFspiopError(t)(opts.fspiopError, notFoundError)
      t.end()
    })

    test.test('should produce proper kafka error message', async (t) => {
      const result = await transferHandlers.fulfil(null, message)
      t.ok(result)
      t.ok(producer.produceMessage.calledOnce)
      const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
      t.equal(topicConfig.topicName, TOPICS.notificationEvent) // check if we have appropriate task/test for FX notification handler
      t.equal(messageProtocol.from, fixtures.SWITCH_ID)
      t.equal(messageProtocol.to, from)
      t.equal(messageProtocol.metadata, message.value.metadata)
      t.equal(messageProtocol.id, message.value.id)
      t.equal(messageProtocol.content.uriParams, message.value.content.uriParams)
      compareFspiopError(t)(messageProtocol.content.payload, notFoundError)
      t.end()
    })

    test.end()
  })

  fxFulfilTest.test('should throw fxValidation error if source-header does not match counterPartyFsp-field from DB', async (t) => {
    const initiatingFsp = fixtures.DFSP1_ID
    const counterPartyFsp = fixtures.FXP_ID
    const fxTransferPayload = fixtures.fxTransferDto({ initiatingFsp, counterPartyFsp })
    const fxTransferDetailsFromDb = fixtures.fxtGetAllDetailsByCommitRequestIdDto(fxTransferPayload)
    fxTransferModel.fxTransfer.getAllDetailsByCommitRequestId.resolves(fxTransferDetailsFromDb)
    fxTransferModel.fxTransfer.saveFxFulfilResponse.resolves({})

    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const content = fixtures.fulfilContentDto({
      from: 'wrongCounterPartyId',
      to: initiatingFsp
    })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ content, metadata })
    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.metadata.event.action, Action.FX_ABORT_VALIDATION)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.fxHeaderSourceValidationError())
    t.equal(topicConfig.topicName, TOPICS.transferPosition)
    t.equal(topicConfig.key, String(fxTransferDetailsFromDb.initiatingFspParticipantCurrencyId))
    t.end()
  })

  fxFulfilTest.test('should detect invalid event type', async (t) => {
    const type = 'wrongType'
    const action = Action.FX_RESERVE
    const metadata = fixtures.fulfilMetadataDto({ type, action })
    const content = fixtures.fulfilContentDto({
      to: fixtures.DFSP1_ID,
      from: fixtures.FXP_ID
    })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata, content })
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    fxTransferModel.fxTransfer.getAllDetailsByCommitRequestId.resolves(fxTransferDetails)
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.metadata.event.action, action)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.invalidEventType(type))
    t.equal(topicConfig.topicName, TOPICS.notificationEvent)
    t.end()
  })

  fxFulfilTest.test('should process case with invalid fulfilment', async (t) => {
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves(fxTransferDetails)
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })
    Validator.validateFulfilCondition.returns(false)

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.metadata.event.action, Action.FX_ABORT_VALIDATION)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.fxInvalidFulfilment())
    t.equal(topicConfig.topicName, TOPICS.transferPosition)
    t.equal(topicConfig.key, String(fxTransferDetails.counterPartyFspTargetParticipantCurrencyId))
    t.end()
  })

  fxFulfilTest.test('should detect invalid fxTransfer state', async (t) => {
    const transferState = 'wrongState'
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({ transferState })
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.metadata.event.action, Action.FX_RESERVE)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.fxTransferNonReservedState())
    t.equal(topicConfig.topicName, TOPICS.notificationEvent)
    t.end()
  })

  fxFulfilTest.test('should detect expired fxTransfer', async (t) => {
    const expirationDate = new Date(Date.now() - 1000 ** 3)
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({ expirationDate })
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateTransferState').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.metadata.event.action, Action.FX_RESERVE)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.fxTransferExpired())
    t.equal(topicConfig.topicName, TOPICS.notificationEvent)
    t.end()
  })

  fxFulfilTest.test('should skip message with fxReject action', async (t) => {
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves(fxTransferDetails)
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateTransferState').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_REJECT })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.notCalled)
    t.end()
  })

  fxFulfilTest.test('should process error callback with fxAbort action', async (t) => {
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves(fxTransferDetails)
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateTransferState').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateExpirationDate').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    const errorInfo = fixtures.errorInfoDto()
    const content = fixtures.fulfilContentDto({ payload: errorInfo })
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_ABORT })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ content, metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.metadata.event.action, Action.FX_ABORT)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.fromErrorInformation(errorInfo.errorInformation))
    t.equal(topicConfig.topicName, TOPICS.transferPosition)
    t.equal(topicConfig.key, String(fxTransferDetails.counterPartyFspTargetParticipantCurrencyId))
    t.end()
  })

  fxFulfilTest.test('should process fxFulfil callback - just skip message if no commitRequestId in watchList', async (t) => {
    // todo: clarify this behaviuor
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves(fxTransferDetails)
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateTransferState').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateExpirationDate').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    fxTransferModel.watchList.getItemInWatchListByCommitRequestId.resolves(null)
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_COMMIT })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.notCalled)
    t.end()
  })

  fxFulfilTest.test('should process fxFulfil callback (commitRequestId is in watchList)', async (t) => {
    const fxTransferDetails = fixtures.fxtGetAllDetailsByCommitRequestIdDto()
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves(fxTransferDetails)
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateEventType').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateFulfilment').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateTransferState').resolves()
    sandbox.stub(FxFulfilService.prototype, 'validateExpirationDate').resolves()
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: false,
      hasDuplicateHash: false
    })
    Validator.validateFulfilCondition.returns(true)
    fxTransferModel.fxTransfer.getAllDetailsByCommitRequestId.resolves(fxTransferDetails)
    fxTransferModel.watchList.getItemInWatchListByCommitRequestId.resolves(fixtures.watchListItemDto())

    const action = Action.FX_COMMIT
    const metadata = fixtures.fulfilMetadataDto({ action })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.metadata.event.action, action)
    t.deepEqual(messageProtocol.metadata.event.state, fixtures.metadataEventStateDto())
    t.deepEqual(messageProtocol.content, kafkaMessage.value.content)
    t.equal(topicConfig.topicName, TOPICS.transferPosition)
    t.equal(topicConfig.key, String(fxTransferDetails.counterPartyFspSourceParticipantCurrencyId))
    t.end()
  })

  fxFulfilTest.test('should detect that duplicate hash was modified', async (t) => {
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: true,
      hasDuplicateHash: false
    })
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({})
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()

    const action = Action.FX_COMMIT
    const metadata = fixtures.fulfilMetadataDto({ action })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.metadata.event.action, Action.FX_FULFIL_DUPLICATE)
    compareFspiopError(t)(messageProtocol.content.payload, fspiopErrorFactory.noFxDuplicateHash())
    t.equal(topicConfig.topicName, TOPICS.transferPosition)
    t.end()
  })

  fxFulfilTest.test('should process duplication if fxTransfer state is COMMITTED', async (t) => {
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: true,
      hasDuplicateHash: true
    })
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({ transferStateEnumeration: TransferState.COMMITTED })
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()

    const action = Action.FX_COMMIT
    const metadata = fixtures.fulfilMetadataDto({ action })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.content.payload, undefined)
    t.equal(messageProtocol.metadata.event.action, Action.FX_FULFIL_DUPLICATE)
    t.equal(topicConfig.topicName, TOPICS.transferPosition) // or TOPICS.notificationEvent ?
    t.end()
  })

  fxFulfilTest.test('should just skip processing duplication if fxTransfer state is RESERVED/RECEIVED', async (t) => {
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: true,
      hasDuplicateHash: true
    })
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({ transferStateEnumeration: TransferState.RESERVED })
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()

    const action = Action.FX_RESERVE
    const metadata = fixtures.fulfilMetadataDto({ action })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.notCalled)
    // todo: clarify, if it's expected behaviour
    t.end()
  })

  fxFulfilTest.test('should process duplication if fxTransfer has invalid state', async (t) => {
    Comparators.duplicateCheckComparator.resolves({
      hasDuplicateId: true,
      hasDuplicateHash: true
    })
    const transferStateEnumeration = TransferState.SETTLED
    sandbox.stub(FxFulfilService.prototype, 'getFxTransferDetails').resolves({ transferStateEnumeration })
    sandbox.stub(FxFulfilService.prototype, 'validateHeaders').resolves()

    const action = Action.FX_COMMIT
    const type = 'fulfil'
    const metadata = fixtures.fulfilMetadataDto({ action, type })
    const kafkaMessage = fixtures.fulfilKafkaMessageDto({ metadata })

    const result = await transferHandlers.fulfil(null, kafkaMessage)

    t.ok(result)
    t.ok(producer.produceMessage.calledOnce)
    const [messageProtocol, topicConfig] = producer.produceMessage.lastCall.args
    t.equal(messageProtocol.from, fixtures.SWITCH_ID)
    t.equal(messageProtocol.metadata.event.action, Action.FX_RESERVE)
    const fspiopError = fspiopErrorFactory.invalidFxTransferState({
      transferStateEnum: transferStateEnumeration,
      type,
      action
    })
    compareFspiopError(t)(messageProtocol.content.payload, fspiopError)
    t.equal(topicConfig.topicName, TOPICS.notificationEvent)
    t.end()
  })

  fxFulfilTest.end()
})
