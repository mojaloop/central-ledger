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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const Test = require('tape')
const Db = require('../../../../src/lib/db')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Producer } = require('@mojaloop/central-services-stream').Kafka

const Config = require('../../../../src/lib/config')
const Cache = require('#src/lib/cache')
const ProxyCache = require('#src/lib/proxyCache')
const fspiopErrorFactory = require('#src/shared/fspiopErrorFactory')
const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const fxTransferModel = require('#src/models/fxTransfer/index')
const prepare = require('#src/handlers/transfers/prepare')
const cyril = require('#src/domain/fx/cyril')
const { logger } = require('#src/shared/logger/index')
const { TABLE_NAMES } = require('#src/shared/constants')

const { checkErrorPayload, wrapWithRetries } = require('#test/util/helpers')
const createTestConsumer = require('#test/integration/helpers/createTestConsumer')
const ParticipantHelper = require('#test/integration/helpers/participant')
const HubAccountsHelper = require('#test/integration/helpers/hubAccounts')
const fixtures = require('#test/fixtures')

const kafkaUtil = Util.Kafka
const { Action, Type } = Enum.Events.Event
const { TOPICS } = fixtures

const storeFxTransferPreparePayload = async (fxTransfer, transferStateId = '', addToWatchList = true) => {
  const { commitRequestId } = fxTransfer
  const isFx = true
  const proxyObligation = {
    isInitiatingFspProxy: false,
    isCounterPartyFspProxy: false,
    initiatingFspProxyOrParticipantId: null,
    counterPartyFspProxyOrParticipantId: null
  }
  const dupResult = await prepare.checkDuplication({
    payload: fxTransfer,
    isFx,
    ID: commitRequestId,
    location: {}
  })
  if (dupResult.hasDuplicateId) throw new Error('fxTransfer prepare Duplication Error')

  await prepare.savePreparedRequest({
    payload: fxTransfer,
    isFx,
    functionality: Type.NOTIFICATION,
    params: {},
    validationPassed: true,
    reasons: [],
    location: {},
    proxyObligation
  })

  if (transferStateId) {
    const knex = Db.getKnex()
    await knex(TABLE_NAMES.fxTransferStateChange)
      .update({
        transferStateId,
        reason: 'fxFulfil int-test'
      })
      .where({ commitRequestId })
    // https://github.com/mojaloop/central-ledger/blob/ad4dd53d6914628813aa30a1dcd3af2a55f12b0d/src/domain/position/fx-prepare.js#L187
    logger.info('fxTransfer state is updated', { transferStateId })
    if (transferStateId === Enum.Transfers.TransferState.RESERVED) {
      const fxTransferStateChangeId = await knex(TABLE_NAMES.fxTransferStateChange).where({ commitRequestId }).select('fxTransferStateChangeId')
      await knex(TABLE_NAMES.participantPositionChange).insert({
        participantPositionId: 1,
        fxTransferStateChangeId: fxTransferStateChangeId[0].fxTransferStateChangeId,
        participantCurrencyId: 1,
        value: 0,
        change: 0,
        reservedValue: 0
      })
    }
  }

  if (addToWatchList) {
    const determiningTransferCheckResult = await cyril.checkIfDeterminingTransferExistsForFxTransferMessage(
      fxTransfer,
      proxyObligation
    )
    await cyril.getParticipantAndCurrencyForFxTransferMessage(fxTransfer, determiningTransferCheckResult)
    logger.info('fxTransfer is added to watchList', { fxTransfer })
  }
}

Test('FxFulfil flow Integration Tests -->', async fxFulfilTest => {
  await Db.connect(Config.DATABASE)
  await Promise.all([
    Cache.initCache(),
    ParticipantCached.initialize(),
    ParticipantCurrencyCached.initialize(),
    ParticipantLimitCached.initialize(),
    HubAccountsHelper.prepareData()
  ])

  const dfspNamePrefix = 'dfsp_'
  const fxpNamePrefix = 'fxp_'
  const sourceAmount = fixtures.amountDto({ currency: 'USD', amount: 433.88 })
  const targetAmount = fixtures.amountDto({ currency: 'XXX', amount: 200.22 })

  const [payer, fxp] = await Promise.all([
    ParticipantHelper.prepareData(dfspNamePrefix, sourceAmount.currency),
    ParticipantHelper.prepareData(fxpNamePrefix, sourceAmount.currency, targetAmount.currency)
  ])
  const DFSP_1 = payer.participant.name
  const FXP = fxp.participant.name

  const createFxFulfilKafkaMessage = ({ commitRequestId, fulfilment, action = Action.FX_RESERVE } = {}) => {
    const content = fixtures.fxFulfilContentDto({
      commitRequestId,
      payload: fixtures.fxFulfilPayloadDto({ fulfilment }),
      from: FXP,
      to: DFSP_1
    })
    const fxFulfilMessage = fixtures.fxFulfilKafkaMessageDto({
      content,
      from: FXP,
      to: DFSP_1,
      metadata: fixtures.fulfilMetadataDto({ action })
    })
    return fxFulfilMessage.value
  }

  const topicFxFulfilConfig = kafkaUtil.createGeneralTopicConf(
    Config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
    Type.TRANSFER,
    Action.FULFIL
  )
  const fxFulfilProducerConfig = kafkaUtil.getKafkaConfig(
    Config.KAFKA_CONFIG,
    Enum.Kafka.Config.PRODUCER,
    Type.TRANSFER.toUpperCase(),
    Action.FULFIL.toUpperCase()
  )
  const producer = new Producer(fxFulfilProducerConfig)
  await producer.connect()
  const produceMessageToFxFulfilTopic = async (message) => producer.sendMessage(message, topicFxFulfilConfig)

  const testConsumer = createTestConsumer([
    { type: Type.NOTIFICATION, action: Action.EVENT },
    { type: Type.TRANSFER, action: Action.POSITION },
    { type: Type.TRANSFER, action: Action.FULFIL }
  ])
  const batchTopicConfig = {
    topicName: TOPICS.transferPositionBatch,
    config: Util.Kafka.getKafkaConfig(
      Config.KAFKA_CONFIG,
      Enum.Kafka.Config.CONSUMER,
      Enum.Events.Event.Type.TRANSFER.toUpperCase(),
      Enum.Events.Event.Action.POSITION.toUpperCase()
    )
  }
  testConsumer.handlers.push(batchTopicConfig)
  await testConsumer.startListening()
  await new Promise(resolve => setTimeout(resolve, 5_000))
  testConsumer.clearEvents()
  fxFulfilTest.pass('setup is done')

  fxFulfilTest.test('should publish a message to send error callback if fxTransfer does not exist', async (t) => {
    const noFxTransferMessage = createFxFulfilKafkaMessage()
    const isTriggered = await produceMessageToFxFulfilTopic(noFxTransferMessage)
    t.ok(isTriggered, 'test is triggered')

    const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
      topicFilter: TOPICS.notificationEvent,
      action: Action.FX_RESERVE,
      valueToFilter: FXP
    }))
    t.ok(messages[0], 'Notification event message is sent')
    t.equal(messages[0].value.id, noFxTransferMessage.id)
    checkErrorPayload(t)(messages[0].value.content.payload, fspiopErrorFactory.fxTransferNotFound())
    t.end()
  })

  fxFulfilTest.test('should process fxFulfil message (happy path)', async (t) => {
    const fxTransfer = fixtures.fxTransferDto({
      initiatingFsp: DFSP_1,
      counterPartyFsp: FXP,
      sourceAmount,
      targetAmount
    })
    const { commitRequestId } = fxTransfer

    await storeFxTransferPreparePayload(fxTransfer, Enum.Transfers.TransferState.RESERVED)
    t.pass(`fxTransfer prepare is saved in DB: ${commitRequestId}`)

    const fxFulfilMessage = createFxFulfilKafkaMessage({ commitRequestId })
    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')

    const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
      topicFilter: TOPICS.transferPositionBatch,
      action: Action.FX_RESERVE
    }))
    t.ok(messages[0], `Message is sent to ${TOPICS.transferPositionBatch}`)
    const knex = Db.getKnex()
    const extension = await knex(TABLE_NAMES.fxTransferExtension).where({ commitRequestId }).select('key', 'value')
    const { from, to, content } = messages[0].value
    t.equal(extension.length, fxFulfilMessage.content.payload.extensionList.extension.length, 'Saved extension')
    t.equal(extension[0].key, fxFulfilMessage.content.payload.extensionList.extension[0].key, 'Saved extension key')
    t.equal(extension[0].value, fxFulfilMessage.content.payload.extensionList.extension[0].value, 'Saved extension value')
    t.equal(from, FXP)
    t.equal(to, DFSP_1)
    t.equal(content.payload.fulfilment, fxFulfilMessage.content.payload.fulfilment, 'fulfilment is correct')
    t.end()
  })

  fxFulfilTest.test('should check duplicates, and detect modified request (hash is not the same)', async (t) => {
    const fxTransfer = fixtures.fxTransferDto({
      initiatingFsp: DFSP_1,
      counterPartyFsp: FXP,
      sourceAmount,
      targetAmount
    })
    const { commitRequestId } = fxTransfer

    await storeFxTransferPreparePayload(fxTransfer, '', false)
    await fxTransferModel.duplicateCheck.saveFxTransferFulfilmentDuplicateCheck(commitRequestId, 'wrongHash')
    t.pass(`fxTransfer prepare and duplicateCheck are saved in DB: ${commitRequestId}`)

    const fxFulfilMessage = createFxFulfilKafkaMessage({ commitRequestId })
    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')

    const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
      topicFilter: TOPICS.notificationEvent,
      action: Action.FX_FULFIL_DUPLICATE
    }))
    t.ok(messages[0], `Message is sent to ${TOPICS.notificationEvent}`)
    const { from, to, content, metadata } = messages[0].value
    t.equal(from, fixtures.SWITCH_ID)
    t.equal(to, FXP)
    t.equal(metadata.event.type, Type.NOTIFICATION)
    checkErrorPayload(t)(content.payload, fspiopErrorFactory.noFxDuplicateHash())
    t.end()
  })

  fxFulfilTest.test('should detect invalid fulfilment', async (t) => {
    const fxTransfer = fixtures.fxTransferDto({
      initiatingFsp: DFSP_1,
      counterPartyFsp: FXP,
      sourceAmount,
      targetAmount
    })
    const { commitRequestId } = fxTransfer

    await storeFxTransferPreparePayload(fxTransfer, Enum.Transfers.TransferState.RESERVED)
    t.pass(`fxTransfer prepare is saved in DB: ${commitRequestId}`)

    const fulfilment = 'wrongFulfilment'
    const fxFulfilMessage = createFxFulfilKafkaMessage({ commitRequestId, fulfilment })
    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')

    const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
      topicFilter: TOPICS.transferPositionBatch,
      action: Action.FX_ABORT_VALIDATION
    }))
    t.ok(messages[0], `Message is sent to ${TOPICS.transferPosition}`)
    const { from, to, content } = messages[0].value
    t.equal(from, fixtures.SWITCH_ID)
    t.equal(to, DFSP_1)
    checkErrorPayload(t)(content.payload, fspiopErrorFactory.fxInvalidFulfilment())
    t.end()
  })

  fxFulfilTest.test('teardown', async (t) => {
    await Promise.all([
      Db.disconnect(),
      Cache.destroyCache(),
      producer.disconnect(),
      testConsumer.destroy()
    ])
    await ProxyCache.disconnect()
    await new Promise(resolve => setTimeout(resolve, 5_000))
    t.pass('teardown is finished')
    t.end()
  })

  fxFulfilTest.end()
})
