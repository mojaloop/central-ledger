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

const Test = require('tape')
const { Db } = require('@mojaloop/database-lib')
const { Enum, Util } = require('@mojaloop/central-services-shared')
const { Producer } = require('@mojaloop/central-services-stream').Kafka

const Config = require('#src/lib/config')
const fspiopErrorFactory = require('#src/shared/fspiopErrorFactory')
const Cache = require('#src/lib/cache')
const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const prepare = require('#src/handlers/transfers/prepare')
const cyril = require('#src/domain/fx/cyril')
const Logger = require('#src/shared/logger/Logger')
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
  const log = new Logger({ commitRequestId })

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
    location: {}
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
    log.info('fxTransfer state is updated', { transferStateId })
  }

  if (addToWatchList) {
    await cyril.getParticipantAndCurrencyForFxTransferMessage(fxTransfer)
    log.info('fxTransfer is added to watchList', { fxTransfer })
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
    ParticipantHelper.prepareData(fxpNamePrefix, sourceAmount.currency)
  ])
  const DFSP_1 = payer.participant.name
  const FXP = fxp.participant.name

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
  await testConsumer.startListening()
  await new Promise(resolve => setTimeout(resolve, 5_000))
  fxFulfilTest.pass('setup is done')

  fxFulfilTest.test('should publish a message to send error callback if fxTransfer does not exist', async (t) => {
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const noFxTransferMessage = fixtures.fxFulfilKafkaMessageDto({
      from: FXP,
      to: DFSP_1,
      metadata
    }).value

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

    const content = fixtures.fxFulfilContentDto({
      commitRequestId,
      from: FXP,
      to: DFSP_1
    })
    const metadata = fixtures.fulfilMetadataDto({ action: Action.FX_RESERVE })
    const fxFulfilMessage = fixtures.fxFulfilKafkaMessageDto({
      from: FXP,
      to: DFSP_1,
      content,
      metadata
    }).value

    const isTriggered = await produceMessageToFxFulfilTopic(fxFulfilMessage)
    t.ok(isTriggered, 'test is triggered')

    const messages = await wrapWithRetries(() => testConsumer.getEventsForFilter({
      topicFilter: TOPICS.transferPosition,
      action: Action.FX_RESERVE
    }))
    t.ok(messages[0], `Message is sent to ${TOPICS.transferPosition}`)
    t.equal(messages[0].value.from, FXP)
    t.equal(messages[0].value.to, DFSP_1)
    t.equal(messages[0].value.content.payload.fulfilment, content.payload.fulfilment, 'fulfilment is correct')
    t.end()
  })

  fxFulfilTest.skip('should detect duplicates, and stop further processing', async (t) => {
    // todo: add impl.
    t.end()
  })

  fxFulfilTest.test('teardown', async (t) => {
    await Promise.all([
      Db.disconnect(),
      Cache.destroyCache(),
      producer.disconnect(),
      testConsumer.destroy()
    ])
    await new Promise(resolve => setTimeout(resolve, 5_000))
    t.pass('teardown is finished')
    t.end()
  })

  fxFulfilTest.end()
})
