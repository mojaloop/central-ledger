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

import { after, before, describe, it } from "node:test"
import assert from "node:assert"
import { Enum } from '@mojaloop/central-services-shared'

import Harness from '../../testing/harness'
import * as ApiHelpers from '../../testing/api-helpers'
import PRNG from '../../testing/prng'
import { assertPositionDiff } from "../../testing/util"

import ParticipantService from '../../domain/participant'
import TransferService from '../../domain/transfer'
import TransferHandler from '../transfers/handler'
import TimeoutHandler from '../timeouts/handler'

// Note: we _must_ use `require()` here, otherwise the global Producer and Consumers are imported
// as empty objects.
const KafkaConsumer = require('@mojaloop/central-services-stream').Util.Consumer
const Utility = require('@mojaloop/central-services-shared').Util.Kafka

const harness = Harness.getInstance()
const prng = new PRNG(4588)
Harness.injectPrngAndPatchDateGlobal(prng)

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const AdminTransferAction = Enum.Transfers.AdminTransferAction
const currency = 'USD'

const topicAdminTransfer = (): string => Utility.transformGeneralTopicName(
  harness.config.KAFKA_CONFIG.TOPIC_TEMPLATES.GENERAL_TOPIC_TEMPLATE.TEMPLATE,
  Enum.Events.Event.Type.ADMIN,
  Enum.Events.Event.Action.TRANSFER
)

const getTransferStateId = async (transferId: string): Promise<string> => {
  const transferState = await TransferService.getTransferState(transferId)
  assert(transferState, `No state found for transfer ${transferId}.`)
  return transferState.transferStateId
}

/**
 * Resolves once the admin handler registered by harness.setupGlobals() has finished with the `action`
 * request for `transferId`, whichever way it decided. A rejected request leaves nothing behind but a log
 * line, so there is no state to wait for; instead the consumer, which runs the handler in sync mode,
 * emits `recursive` after every batch the handler has returned from. Call this before producing.
 */
const adminHandled = (transferId: string, action: string, timeoutMs = 10_000): Promise<void> =>
  new Promise((resolve, reject) => {
    const consumer = KafkaConsumer.getConsumer(topicAdminTransfer())
    const timer = setTimeout(() => {
      consumer.off('recursive', onBatch)
      reject(new Error(`The admin handler did not get to the ${action} of transfer ${transferId} within ${timeoutMs}ms.`))
    }, timeoutMs)
    const onBatch = (error: Error | null, messages?: Array<any>) => {
      const handled = messages?.some(message =>
        message.value?.id === transferId && message.value?.content?.payload?.action === action)
      if (!handled) {
        return
      }
      clearTimeout(timer)
      consumer.off('recursive', onBatch)
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    consumer.on('recursive', onBatch)
  })

/**
 * Sends the admin API request behind `POST /participants/{name}/accounts/{id}` for a
 * recordFundsOutPrepareReserve and checks the reservation.
 */
const recordFundsOutPrepareReserve = async (name: string, transferId: string, amount: string): Promise<void> => {
  const settlementAccount = await ApiHelpers.getSettlementAccount(name, currency)
  const payload = {
    action: AdminTransferAction.RECORD_FUNDS_OUT_PREPARE_RESERVE,
    reason: 'withdrawal',
    externalReference: `withdrawal-${transferId}`,
    amount: { amount, currency }
  }
  const mark = harness.redpandaMark()
  const handled = adminHandled(transferId, payload.action)
  await ParticipantService.recordFundsInOut(payload, { name, id: settlementAccount.id, transferId }, harness.enums)
  await harness.redpandaDrain(mark, 1)
  await handled
  assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
}

/**
 * Sends the admin API request behind `PUT /participants/{name}/accounts/{id}/transfers/{transferId}`
 * for a recordFundsOutCommit or recordFundsOutAbort and returns once the admin handler is done with it.
 * The caller checks what came of it: an accepted request changes the transfer state, a rejected one
 * changes nothing.
 */
const recordFundsOutCommitOrAbort = async (action: string, name: string, transferId: string): Promise<void> => {
  const settlementAccount = await ApiHelpers.getSettlementAccount(name, currency)
  const payload = { action, reason: `${action} by ${name}` }
  const mark = harness.redpandaMark()
  const handled = adminHandled(transferId, action)
  await ParticipantService.recordFundsInOut(payload, { name, id: settlementAccount.id, transferId }, harness.enums)
  await harness.redpandaDrain(mark, 1)
  await handled
}

const recordFundsOutCommit = (name: string, transferId: string): Promise<void> =>
  recordFundsOutCommitOrAbort(AdminTransferAction.RECORD_FUNDS_OUT_COMMIT, name, transferId)

const recordFundsOutAbort = (name: string, transferId: string): Promise<void> =>
  recordFundsOutCommitOrAbort(AdminTransferAction.RECORD_FUNDS_OUT_ABORT, name, transferId)

/**
 * Lets every open reservation expire by moving the test clock past INTERNAL_TRANSFER_VALIDITY_SECONDS,
 * the validity of a recordFundsOut reservation, instead of waiting for it. The clock is behind every
 * `new Date()` in the process, so the admin handler's expiry check and the timestamp the timeout handler
 * compares `expirationDate` against move with it. The extra day covers the driver reading that UTC column
 * back in the test runner's own timezone.
 */
const letReservationsExpire = (): void => {
  harness.clock.tick(harness.config.INTERNAL_TRANSFER_VALIDITY_SECONDS + 24 * 60 * 60, 's')
}

describe('handlers/admin/handler', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    // The P2P transfer scenario prepares a transfer through the prepare handler, which commits its
    // kafka offset on the `topic-transfer-prepare` consumer.
    await TransferHandler.registerPrepareHandler()
    await TransferHandler.registerFulfilHandler()

    await ApiHelpers.createHub(harness, {
      currencies: [currency],
      settlementModels: [{
        name: `DEFERRED_MULTILATERAL_NET_${currency}`,
        settlementGranularity: "NET",
        settlementInterchange: "MULTILATERAL",
        settlementDelay: "DEFERRED",
        currency,
        requireLiquidityCheck: true,
        ledgerAccountType: "POSITION",
        settlementAccountType: "SETTLEMENT",
        autoPositionReset: true
      }]
    })
    const dfsp = (name: string): ApiHelpers.CreateDfspPayload => ({
      name,
      currencies: [currency],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ApiHelpers.createDfsp(harness, dfsp('dfsp_a'))
    await ApiHelpers.createDfsp(harness, dfsp('dfsp_b'))
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('recordFundsOutAbort releases an expired reservation the timeout handler marked RESERVED_TIMEOUT (mojaloop/project#4588)', async () => {
    const transferId = '4588000001'
    const settlementStart = await ApiHelpers.getSettlementAccount('dfsp_a', currency)

    await recordFundsOutPrepareReserve('dfsp_a', transferId, '100.00')
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })

    // Once the reservation has expired the timeout handler marks it RESERVED_TIMEOUT, but it only
    // releases the position of PAYER_DFSP/PAYEE_DFSP transfers: the settlement account stays reserved.
    letReservationsExpire()
    await TimeoutHandler.timeout()
    assert.equal(await getTransferStateId(transferId), TransferInternalState.RESERVED_TIMEOUT)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })

    // It can no longer be committed.
    await recordFundsOutCommit('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.RESERVED_TIMEOUT)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })

    // The operator's abort is the only thing that can release it.
    await recordFundsOutAbort('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })

    // A second abort finds nothing left to release.
    await recordFundsOutAbort('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })
  })

  it('recordFundsOutAbort releases an expired reservation that is still RESERVED (mojaloop/project#4588)', async () => {
    const transferId = '4588000002'
    const settlementStart = await ApiHelpers.getSettlementAccount('dfsp_a', currency)

    await recordFundsOutPrepareReserve('dfsp_a', transferId, '100.00')
    letReservationsExpire()

    // The expired reservation cannot be committed, only aborted.
    await recordFundsOutCommit('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })

    await recordFundsOutAbort('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })
  })

  it('recordFundsOutAbort ignores a P2P transfer, whose position the position handler releases on timeout', async () => {
    const transferId = '4588000003'
    const positionStart = await ApiHelpers.getPositionAccount('dfsp_a', currency)
    const settlementStart = await ApiHelpers.getSettlementAccount('dfsp_a', currency)

    await ApiHelpers.buildPayment()
      .deps(harness, TransferHandler)
      .parties('dfsp_a', 'dfsp_b')
      .transferId(transferId)
      .amount('25.00', currency)
      .build()
      .prepare()
    assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount('dfsp_a', currency), { posted: 25 })

    // The transfer has no DFSP_SETTLEMENT / RECORD_FUNDS_OUT participant row, so the abort is rejected
    // whatever settlement account it names.
    await recordFundsOutAbort('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
    assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount('dfsp_a', currency), { posted: 25 })
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })

    // The position handler releases the payer position exactly once, when the transfer times out. Its
    // notification is the second message: by then the state change and the position are in the database.
    letReservationsExpire()
    const mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 2)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.EXPIRED_RESERVED)
    assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount('dfsp_a', currency), { posted: 0 })
  })

  it('recordFundsOutAbort ignores a reservation made on another participant\'s settlement account', async () => {
    const transferId = '4588000004'
    const settlementStartA = await ApiHelpers.getSettlementAccount('dfsp_a', currency)
    const settlementStartB = await ApiHelpers.getSettlementAccount('dfsp_b', currency)

    await recordFundsOutPrepareReserve('dfsp_a', transferId, '100.00')
    letReservationsExpire()

    // dfsp_b names dfsp_a's reservation together with its own settlement account.
    await recordFundsOutAbort('dfsp_b', transferId)
    assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
    assertPositionDiff('payer', settlementStartA, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })
    assertPositionDiff('payer', settlementStartB, await ApiHelpers.getSettlementAccount('dfsp_b', currency), { posted: 0 })

    // The account the reservation was made on can still release it.
    await recordFundsOutAbort('dfsp_a', transferId)
    assert.equal(await getTransferStateId(transferId), TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStartA, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })
  })
})
