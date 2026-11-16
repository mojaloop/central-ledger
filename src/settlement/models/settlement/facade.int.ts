/*****
 License
 --------------
 Copyright © 2020-2026 Mojaloop Foundation
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
 --------------
 ******/

/**
 * Deferred net settlement, end to end against the harness database and Kafka.
 *
 * One scenario, in order, because every step needs the state the previous one left behind:
 *
 *   1. three transfers between two DFSPs, two before the settlement window starts closing and one after;
 *   2. the close is refused while the position changes of the window do not sum to zero;
 *   3. the window is closed, which aggregates its transfers into settlementContentAggregation;
 *   4. a settlement is created for the closed window;
 *   5. the settlement is walked through PS_TRANSFERS_RECORDED, PS_TRANSFERS_RESERVED,
 *      PS_TRANSFERS_COMMITTED and SETTLED, which moves the positions back and leaves the net debit
 *      caps alone.
 *
 * The steps call the settlement services the API handlers and the deferredSettlement handler call,
 * rather than going through HTTP or Kafka: the harness boots no hapi server and does not register the
 * deferredSettlement consumer. The unit tests of these modules stub knex, so this file is what runs
 * their SQL against a real database.
 *
 * What it cannot show:
 *
 *   - behaviour specific to MySQL, because the harness runs MariaDB, as root. In particular, close()
 *     creates a temporary table, for which the service's database user needs the CREATE TEMPORARY
 *     TABLES privilege;
 *   - the wait of WINDOW_AGGREGATION.CLOSE_DELAY_MS before a window is closed, which happens in the
 *     deferredSettlement handler and is covered by that handler's unit test;
 *   - the deadlock retry of putById(). A deadlock cannot be staged reliably here, and no unit test
 *     exercises that path either.
 *
 * See "Settlement scenario" in the README for a sequence diagram.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert'

import Harness, { MojaloopKafkaMessage } from '../../../testing/harness'
import * as ApiHelpers from '../../../testing/api-helpers'
import { waitForLastMessage } from '../../../testing/util'
import ParticipantService from '../../../domain/participant'
import TransferHandler from '../../../handlers/transfers/handler'

const harness = Harness.getInstance()

const currency = 'USD'
const settlementModel = `DEFERRED_MULTILATERAL_NET_${currency}`
const reason = 'settlement integration test'
const topicNotification = 'topic-notification-event'
/** The net debit cap of both DFSPs. */
const netDebitCap = 100000
/** The cap dfsp_b had before it was raised. It stays in the database as an inactive limit. */
const staleNetDebitCap = 10

// Required in before(), once harness.setupGlobals() has overridden the global config.
let Db: any
let SettlementWindowService: any
let SettlementWindowModel: any
let SettlementService: any
let SettlementProducer: any
let enums: any

type Account = { participantId: number, accountId: number }

let closedWindowId: number
let openWindowId: number
let settlementId: number
/** dfsp_a owes 70 for the closed window. */
let netSender: Account
/** dfsp_b is owed 70 for the closed window. */
let netRecipient: Account

const pay = (payer: string, payee: string, transferId: string, amount: string) =>
  ApiHelpers.buildPayment()
    .deps(harness, TransferHandler)
    .parties(payer, payee)
    .transferId(transferId)
    .amount(amount, currency)
    .build()
    .prepareAndFulfil()

const windowState = async (settlementWindowId: number): Promise<string> =>
  (await SettlementWindowService.getById({ settlementWindowId })).state

/** Position of dfsp_a, then of dfsp_b. */
const positions = async (): Promise<Array<string>> =>
  (await ApiHelpers.getPositions('dfsp_a', 'dfsp_b', currency)).map(account => account.value)

/** The NET_DEBIT_CAP limits of the position account of a DFSP, oldest first, as [value, isActive]. */
const netDebitCapsOf = async (name: string): Promise<Array<[number, number]>> => {
  const knex = await Db.getKnex()
  const account = await ApiHelpers.getPositionAccount(name, currency)
  const limits = await knex('participantLimit')
    .where({
      participantCurrencyId: account.id,
      participantLimitTypeId: enums.participantLimitTypes.NET_DEBIT_CAP
    })
    .orderBy('participantLimitId')
    .select('value', 'isActive')
  return limits.map((limit: any) => [Number(limit.value), limit.isActive])
}

/** The aggregation rows close() wrote for a window, one per account and role. */
const aggregationOf = async (settlementWindowId: number): Promise<Array<any>> => {
  const knex = await Db.getKnex()
  return knex('settlementContentAggregation AS sca')
    .join('settlementWindowContent AS swc', 'swc.settlementWindowContentId', 'sca.settlementWindowContentId')
    .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'sca.participantCurrencyId')
    .join('participant AS p', 'p.participantId', 'pc.participantId')
    .join('transferParticipantRoleType AS tprt', 'tprt.transferParticipantRoleTypeId', 'sca.transferParticipantRoleTypeId')
    .where('swc.settlementWindowId', settlementWindowId)
    .orderBy(['p.name', 'tprt.name'])
    .select('p.name AS participant', 'tprt.name AS role', 'sca.amount', 'sca.currentStateId AS state', 'sca.settlementId')
}

/**
 * What PUT /settlements/{id} does. putById() reports an account it refuses in the response and still
 * resolves, so every returned account is checked. Resolves with the state of the settlement.
 */
const moveAccounts = async (state: string, accounts: Array<Account>): Promise<string> => {
  const payload = {
    participants: accounts.map(({ participantId, accountId }) => ({
      id: participantId,
      accounts: [{ id: accountId, state, reason }]
    }))
  }
  const result = await SettlementService.putById(settlementId, payload, enums)

  const returned = result.participants.flatMap((participant: any) => participant.accounts)
  assert.equal(returned.length, accounts.length)
  for (const account of returned) {
    assert.equal(account.errorInformation, undefined, JSON.stringify(account.errorInformation))
    assert.equal(account.state, state)
  }
  return result.state
}

/** Whether a message is a notification that a settlement changed a position. */
const isSettlementNotification = (message: MojaloopKafkaMessage): boolean =>
  message.topic === topicNotification &&
  message.valueParsed.metadata?.event?.action === 'settlement-transfer-position-change'

/** Matches the notification that tells `to` that a settlement changed its position to `value`. */
const positionNotification = (to: string, value: number) => (message: MojaloopKafkaMessage): boolean => {
  const parsed = message.valueParsed as any
  return isSettlementNotification(message) &&
    parsed.to === to &&
    parsed.content?.payload?.currency === currency &&
    Number(parsed.content?.payload?.value) === value
}

/** Matches the notification that the net debit cap of `name` was set to `value`. */
const limitNotification = (name: string, value: number) => (message: MojaloopKafkaMessage): boolean => {
  const payload = message.valueParsed.content?.payload
  return message.topic === topicNotification && payload?.name === name && payload?.limit?.value === value
}

describe('settlement/models/settlement/facade', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    Db = require('../../lib/db')
    SettlementWindowService = require('../../domain/settlementWindow')
    SettlementWindowModel = require('../settlementWindow')
    SettlementService = require('../../domain/settlement')
    SettlementProducer = require('../../lib/kafka/producer')

    // The object the API handlers build through request.server.methods.enums(name).
    const Enums = require('../lib/enums')
    const enumNames = [
      'ledgerAccountTypes', 'ledgerEntryTypes', 'participantLimitTypes', 'settlementDelay',
      'settlementGranularity', 'settlementInterchange', 'settlementStates', 'settlementWindowStates',
      'transferParticipantRoleTypes', 'transferStates', 'transferStateEnums'
    ]
    const enumValues = await Promise.all(enumNames.map(name => Enums[name]()))
    enums = Object.fromEntries(enumNames.map((name, index) => [name, enumValues[index]]))

    // prepare() and fulfil() are called directly, but they commit kafka offsets, so their consumers
    // have to be connected.
    await TransferHandler.registerPrepareHandler()
    await TransferHandler.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: [currency],
      settlementModels: [{
        name: settlementModel,
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        currency,
        // Makes the reserve step read the NET_DEBIT_CAP limit of the net recipient.
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        settlementAccountType: 'SETTLEMENT',
        // Without it putById() changes states but moves no position.
        autoPositionReset: true
      }]
    })
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_a',
      currencies: [currency],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: netDebitCap }],
      deposits: [10000]
    })
    // dfsp_b gets its net debit cap in two steps, which leaves its first limit behind as an inactive row.
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_b',
      currencies: [currency],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: staleNetDebitCap }],
      deposits: [10000]
    })
    await ParticipantService.adjustLimits('dfsp_b', {
      currency,
      limit: { type: 'NET_DEBIT_CAP', value: netDebitCap }
    })
    // Wait for its notification, so that it cannot arrive in the middle of a payment.
    await waitForLastMessage(harness, limitNotification('dfsp_b', netDebitCap), 'the limit notification of dfsp_b')
  })

  after(async () => {
    // putById() produces through the settlement module's own producer registry, which
    // harness.teardownGlobals() does not know about. A connected producer keeps the process alive.
    await SettlementProducer?.disconnect().catch(() => { /* Nothing was produced. */ })
    await harness.teardownGlobals()
    await harness.down()
  })

  it('process() starts closing the window and opens the next one', async () => {
    await pay('dfsp_a', 'dfsp_b', '7000001', '100.00')
    await pay('dfsp_b', 'dfsp_a', '7000002', '30.00')

    const [open] = await SettlementWindowService.getByParams({ query: { state: 'OPEN' } })
    closedWindowId = open.settlementWindowId

    // The database half of POST /settlementWindows/{id}. The API also produces the message that makes
    // the deferredSettlement handler call close().
    openWindowId = await SettlementWindowModel.process(
      { settlementWindowId: closedWindowId, reason }, enums.settlementWindowStates
    )
    assert.deepEqual(
      [await windowState(closedWindowId), await windowState(openWindowId)],
      ['PROCESSING', 'OPEN']
    )

    // Fulfilled while the first window is being closed, so it belongs to the new one. It also leaves
    // dfsp_b in a position that the settlement will move above its old net debit cap, but not above
    // its current one.
    await pay('dfsp_b', 'dfsp_a', '7000003', '20.00')
  })

  it('close() refuses a window whose position changes do not sum to zero', async () => {
    const knex = await Db.getKnex()
    const [positionChange] = await knex('participantPositionChange AS ppc')
      .join('transferStateChange AS tsc', 'tsc.transferStateChangeId', 'ppc.transferStateChangeId')
      .where('tsc.transferId', '7000001')
      .orderBy('ppc.participantPositionChangeId')
      .select('ppc.participantPositionChangeId AS id', 'ppc.change')
    const setChange = (change: string | number) =>
      knex('participantPositionChange').where('participantPositionChangeId', positionChange.id).update({ change })

    // Unbalance the window by dropping what the payer of the first transfer owes.
    await setChange(0)
    try {
      await assert.rejects(SettlementWindowService.close(closedWindowId, reason), /not balanced/)

      // The window is left as it was, with nothing aggregated.
      assert.equal(await windowState(closedWindowId), 'PROCESSING')
      assert.deepEqual(await aggregationOf(closedWindowId), [])
    } finally {
      await setChange(positionChange.change)
    }
  })

  it('close() aggregates the transfers of the closed window, and only those', async () => {
    const closed = await SettlementWindowService.close(closedWindowId, reason)
    assert.equal(closed.state, 'CLOSED')
    // closedDate is when the window was closed. A window that has not been closed has none.
    assert.ok(closed.closedDate)
    assert.equal((await SettlementWindowService.getById({ settlementWindowId: openWindowId })).closedDate, null)

    const aggregation = await aggregationOf(closedWindowId)
    assert.deepEqual(
      aggregation.map(row => [row.participant, row.role, row.amount, row.state, row.settlementId]),
      [
        ['dfsp_a', 'PAYEE_DFSP', '-30.0000', 'CLOSED', null],
        ['dfsp_a', 'PAYER_DFSP', '100.0000', 'CLOSED', null],
        ['dfsp_b', 'PAYEE_DFSP', '-100.0000', 'CLOSED', null],
        ['dfsp_b', 'PAYER_DFSP', '30.0000', 'CLOSED', null]
      ]
    )
    assert.equal(aggregation.reduce((sum, row) => sum + Number(row.amount), 0), 0)
    assert.deepEqual(await aggregationOf(openWindowId), [])

    const { content } = await SettlementWindowService.getById({ settlementWindowId: closedWindowId })
    assert.deepEqual(
      content.map((c: any) => [c.state, c.ledgerAccountType, c.currencyId]),
      [['CLOSED', 'POSITION', currency]]
    )
  })

  it('settlementEventTrigger() nets the closed window per position account', async () => {
    const settlement = await SettlementService.settlementEventTrigger(
      { settlementModel, reason, settlementWindows: [{ id: closedWindowId }] }, enums
    )
    settlementId = settlement.id
    assert.equal(settlement.state, 'PENDING_SETTLEMENT')
    assert.equal(await windowState(closedWindowId), 'PENDING_SETTLEMENT')

    const accountWith = (net: number): Account => {
      const participant = settlement.participants.find((p: any) =>
        Number(p.accounts[0].netSettlementAmount.amount) === net)
      assert(participant, `no settlement account with a net amount of ${net}`)
      return { participantId: participant.id, accountId: participant.accounts[0].id }
    }
    netSender = accountWith(70)
    netRecipient = accountWith(-70)
    assert.equal(netSender.accountId, (await ApiHelpers.getPositionAccount('dfsp_a', currency)).id)
    assert.equal(netRecipient.accountId, (await ApiHelpers.getPositionAccount('dfsp_b', currency)).id)
  })

  it('putById() walks the settlement to SETTLED and moves the positions back', async () => {
    const both = [netSender, netRecipient]
    // 100 - 30 from the closed window, 20 the other way from the open one.
    assert.deepEqual(await positions(), ['50.0000', '-50.0000'])

    // Creates the two settlement transfers. No position moves yet.
    assert.equal(await moveAccounts('PS_TRANSFERS_RECORDED', both), 'PS_TRANSFERS_RECORDED')
    assert.deepEqual(await positions(), ['50.0000', '-50.0000'])

    // Reserves them: the net recipient is credited and notified.
    assert.equal(await moveAccounts('PS_TRANSFERS_RESERVED', both), 'PS_TRANSFERS_RESERVED')
    assert.deepEqual(await positions(), ['50.0000', '20.0000'])
    await waitForLastMessage(harness, positionNotification('dfsp_b', 20), 'the position notification of dfsp_b')
    // It is the first one: recording the transfers notified nobody.
    assert.equal(isSettlementNotification(harness.spoolLast(2)[0]), false)
    // The net recipient is checked against its active net debit cap. Checked against the inactive one
    // it would be found over its cap, and its limit would be replaced.
    assert.deepEqual(await netDebitCapsOf('dfsp_b'), [[staleNetDebitCap, 0], [netDebitCap, 1]])

    // Commits them: the net sender is debited and notified.
    assert.equal(await moveAccounts('PS_TRANSFERS_COMMITTED', both), 'PS_TRANSFERS_COMMITTED')
    assert.deepEqual(await positions(), ['-20.0000', '20.0000'])
    await waitForLastMessage(harness, positionNotification('dfsp_a', -20), 'the position notification of dfsp_a')
    // It directly follows the one for dfsp_b: each of the two steps notified exactly once.
    assert.equal(positionNotification('dfsp_b', 20)(harness.spoolLast(2)[0]), true)

    // The settlement is SETTLING until its last account is settled.
    assert.equal(await moveAccounts('SETTLED', [netSender]), 'SETTLING')
    assert.equal(await windowState(closedWindowId), 'PENDING_SETTLEMENT')
    assert.equal(await moveAccounts('SETTLED', [netRecipient]), 'SETTLED')
  })

  it('leaves the settlement, the window and its content SETTLED', async () => {
    const settlement = await SettlementService.getById({ settlementId }, enums)
    assert.equal(settlement.state, 'SETTLED')
    assert.deepEqual(
      settlement.settlementWindows.map((w: any) => [w.id, w.state, w.content[0].state]),
      [[closedWindowId, 'SETTLED', 'SETTLED']]
    )
    assert.deepEqual(
      settlement.participants.map((p: any) => p.accounts[0].state),
      ['SETTLED', 'SETTLED']
    )
    assert.deepEqual(
      (await aggregationOf(closedWindowId)).map(row => [row.state, row.settlementId]),
      new Array(4).fill(['SETTLED', settlementId])
    )
    assert.deepEqual(
      [await windowState(closedWindowId), await windowState(openWindowId)],
      ['SETTLED', 'OPEN']
    )

    const knex = await Db.getKnex()
    // The settlement transfers are fulfilled outside any window, so no later close() aggregates them.
    const fulfilments = await knex('settlementParticipantCurrency AS spc')
      .join('transferFulfilment AS tf', 'tf.transferId', 'spc.settlementTransferId')
      .where('spc.settlementId', settlementId)
      .select('tf.settlementWindowId')
    assert.deepEqual(fulfilments.map((row: any) => row.settlementWindowId), [null, null])

    // Settling the accounts notified nobody: the last message is still the one of the commit step.
    assert.equal(positionNotification('dfsp_a', -20)(harness.spoolLast(1)[0]), true)

    // Only the transfer of the open window is left on the positions, and the hub account nets to zero.
    assert.deepEqual(await positions(), ['-20.0000', '20.0000'])
    const hub = await knex('participantPosition AS pp')
      .join('participantCurrency AS pc', 'pc.participantCurrencyId', 'pp.participantCurrencyId')
      .where({
        'pc.participantId': harness.config.HUB_ID,
        'pc.currencyId': currency,
        'pc.ledgerAccountTypeId': enums.ledgerAccountTypes.HUB_MULTILATERAL_SETTLEMENT
      })
      .first('pp.value')
    assert.equal(Number(hub.value), 0)
  })
})
