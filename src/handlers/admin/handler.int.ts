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
import { assertPositionDiff, sleepSeconds } from "../../testing/util"

import Db from '../../lib/db'
import ParticipantService from '../../domain/participant'
import TransferService from '../../domain/transfer'
import TransferHandler from '../transfers/handler'
import TimeoutHandler from '../timeouts/handler'

const Time = require('@mojaloop/central-services-shared').Util.Time

const harness = Harness.getInstance()

const TransferState = Enum.Transfers.TransferState
const TransferInternalState = Enum.Transfers.TransferInternalState
const AdminTransferAction = Enum.Transfers.AdminTransferAction
const currency = 'USD'

/**
 * The admin handler registered by harness.setupGlobals() consumes `topic-admin-transfer` in the
 * background, so the outcome of a recordFunds request shows up in the database a moment later.
 */
const waitForTransferState = async (transferId: string, transferStateId: string, attempts = 50): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const transferState = await TransferService.getTransferState(transferId)
    if (transferState?.transferStateId === transferStateId) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Transfer ${transferId} did not reach state ${transferStateId} after ${attempts} attempts.`)
}

const getTransferStateId = async (transferId: string): Promise<string> => {
  const transferState = await TransferService.getTransferState(transferId)
  assert(transferState, `No state found for transfer ${transferId}.`)
  return transferState.transferStateId
}

/**
 * Sends the admin API request behind `POST /participants/{name}/accounts/{id}` for a
 * recordFundsOutPrepareReserve and waits for the reservation.
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
  await ParticipantService.recordFundsInOut(payload, { name, id: settlementAccount.id, transferId }, harness.enums)
  await harness.redpandaDrain(mark, 1)
  await waitForTransferState(transferId, TransferState.RESERVED)
}

/**
 * Sends the admin API request behind `PUT /participants/{name}/accounts/{id}/transfers/{transferId}`
 * for a recordFundsOutAbort. The caller decides what to wait for: an accepted abort changes the
 * transfer state, a rejected one leaves no trace other than a log line.
 */
const recordFundsOutAbort = async (name: string, transferId: string): Promise<void> => {
  const settlementAccount = await ApiHelpers.getSettlementAccount(name, currency)
  const payload = {
    action: AdminTransferAction.RECORD_FUNDS_OUT_ABORT,
    reason: 'reservation expired'
  }
  const mark = harness.redpandaMark()
  await ParticipantService.recordFundsInOut(payload, { name, id: settlementAccount.id, transferId }, harness.enums)
  await harness.redpandaDrain(mark, 1)
}

/**
 * Moves the transfer's expiration into the past instead of waiting INTERNAL_TRANSFER_VALIDITY_SECONDS.
 * The column holds a UTC wall-clock value that the driver reads back in its own timezone, so the
 * expiration is moved back by two days: further than any timezone offset, whatever the test runner's
 * timezone is. The admin handler compares the date in JavaScript and the timeout handler in SQL, so
 * both views are checked.
 */
const expireTransfer = async (transferId: string): Promise<void> => {
  const expirationDate = Time.getUTCString(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000))
  await Db.getKnex()('transfer').where({ transferId }).update({ expirationDate })

  const transfer = await TransferService.getTransferById(transferId)
  assert(new Date(transfer.expirationDate) <= new Date(), `Transfer ${transferId} is not expired yet: ${transfer.expirationDate}.`)
  const [{ expired }] = await Db.getKnex()('transfer')
    .select(Db.getKnex().raw('expirationDate < ? AS expired', [Time.getUTCString(new Date())]))
    .where({ transferId })
  assert.equal(Number(expired), 1, `Transfer ${transferId} is not expired for the timeout handler.`)
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
    for (const name of ['dfsp_a', 'dfsp_b']) {
      await ApiHelpers.createDfsp(harness, {
        name,
        currencies: [currency],
        isProxy: false,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
        deposits: [10000]
      })
    }
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
    await expireTransfer(transferId)
    await TimeoutHandler.timeout()
    await waitForTransferState(transferId, TransferInternalState.RESERVED_TIMEOUT)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })

    // The operator's abort is the only thing that can release it.
    await recordFundsOutAbort('dfsp_a', transferId)
    await waitForTransferState(transferId, TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })
  })

  it('recordFundsOutAbort releases an expired reservation that is still RESERVED (mojaloop/project#4588)', async () => {
    const transferId = '4588000002'
    const settlementStart = await ApiHelpers.getSettlementAccount('dfsp_a', currency)

    await recordFundsOutPrepareReserve('dfsp_a', transferId, '100.00')
    await expireTransfer(transferId)

    await recordFundsOutAbort('dfsp_a', transferId)
    await waitForTransferState(transferId, TransferInternalState.ABORTED_REJECTED)
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
    await sleepSeconds(2)
    assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
    assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount('dfsp_a', currency), { posted: 25 })
    assertPositionDiff('payer', settlementStart, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })

    // The position handler releases the payer position exactly once, when the transfer times out.
    await expireTransfer(transferId)
    const mark = harness.redpandaMark()
    await TimeoutHandler.timeout()
    await harness.redpandaDrain(mark, 2)
    await waitForTransferState(transferId, TransferInternalState.EXPIRED_RESERVED)
    assertPositionDiff('payer', positionStart, await ApiHelpers.getPositionAccount('dfsp_a', currency), { posted: 0 })
  })

  it('recordFundsOutAbort ignores a reservation made on another participant\'s settlement account', async () => {
    const transferId = '4588000004'
    const settlementStartA = await ApiHelpers.getSettlementAccount('dfsp_a', currency)
    const settlementStartB = await ApiHelpers.getSettlementAccount('dfsp_b', currency)

    await recordFundsOutPrepareReserve('dfsp_a', transferId, '100.00')
    await expireTransfer(transferId)

    // dfsp_b names dfsp_a's reservation together with its own settlement account.
    await recordFundsOutAbort('dfsp_b', transferId)
    await sleepSeconds(2)
    assert.equal(await getTransferStateId(transferId), TransferState.RESERVED)
    assertPositionDiff('payer', settlementStartA, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 100 })
    assertPositionDiff('payer', settlementStartB, await ApiHelpers.getSettlementAccount('dfsp_b', currency), { posted: 0 })

    // The account the reservation was made on can still release it.
    await recordFundsOutAbort('dfsp_a', transferId)
    await waitForTransferState(transferId, TransferInternalState.ABORTED_REJECTED)
    assertPositionDiff('payer', settlementStartA, await ApiHelpers.getSettlementAccount('dfsp_a', currency), { posted: 0 })
  })
})
