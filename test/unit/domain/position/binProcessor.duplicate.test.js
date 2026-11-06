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
 - Shashikant Hirugade

 --------------
 ******/

'use strict'

/**
 * Regression tests for processBins: a duplicate position message from the prepare handler
 * must not reserve the payer's funds twice.
 *
 * Design: position-idempotency-duplicate-prepare.md
 *   - Change 2: the state check uses the running state of the batch
 *   - Change 3: transfer states are read after the position rows are locked
 *
 * These tests fail on v20.3.1 and are expected to pass once the design is implemented.
 */

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const { Enum } = require('@mojaloop/central-services-shared')
const BinProcessor = require('../../../../src/domain/position/binProcessor')
const BatchPositionModel = require('../../../../src/models/position/batch')
const BatchPositionModelCached = require('../../../../src/models/position/batchCached')
const SettlementModelCached = require('../../../../src/models/settlement/settlementModelCached')
const participantFacade = require('../../../../src/models/participant/facade')

const State = Enum.Transfers.TransferInternalState
const trx = {}

const PAYER = 'dfsp1'
const PAYEE = 'dfsp2'
const AMOUNT = 2

// Payer: participant 2, position account 7, settlement account 8 (USD)
const PAYER_POSITION_ACCOUNT = 7
const PAYER_SETTLEMENT_ACCOUNT = 8

const T1 = 'b1b2c3d4-0000-4000-8000-000000000001'
const T2 = 'b1b2c3d4-0000-4000-8000-000000000002'

const positionMessage = (transferId) => ({
  message: {
    key: Buffer.from(String(PAYER_POSITION_ACCOUNT)),
    value: {
      from: PAYER,
      to: PAYEE,
      id: transferId,
      content: {
        uriParams: { id: transferId },
        headers: {
          'content-type': 'application/vnd.interoperability.transfers+json;version=1.1',
          'fspiop-source': PAYER,
          'fspiop-destination': PAYEE
        },
        payload: {},
        context: {}
      },
      type: 'application/json',
      metadata: { event: { type: 'position', action: Enum.Events.Event.Action.PREPARE } }
    }
  },
  span: {},
  decodedPayload: {
    transferId,
    payerFsp: PAYER,
    payeeFsp: PAYEE,
    amount: { amount: String(AMOUNT), currency: 'USD' },
    expiration: '2030-01-01T00:00:00.000Z'
  },
  result: {}
})

const binsWith = (...binItems) => ({
  [PAYER_POSITION_ACCOUNT]: { [Enum.Events.Event.Action.PREPARE]: binItems }
})

Test('BinProcessor: duplicate position message (position-idempotency-duplicate-prepare)', binProcessorTest => {
  let sandbox

  binProcessorTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(BatchPositionModel)
    sandbox.stub(BatchPositionModelCached)
    sandbox.stub(SettlementModelCached)
    sandbox.stub(participantFacade)

    BatchPositionModelCached.getParticipantCurrencyByIds.returns([
      { participantCurrencyId: PAYER_POSITION_ACCOUNT, participantId: 2, currencyId: 'USD', ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.POSITION }
    ])
    BatchPositionModelCached.getParticipantCurrencyByParticipantIds.returns([
      { participantCurrencyId: PAYER_POSITION_ACCOUNT, participantId: 2, currencyId: 'USD', ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.POSITION },
      { participantCurrencyId: PAYER_SETTLEMENT_ACCOUNT, participantId: 2, currencyId: 'USD', ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.SETTLEMENT }
    ])
    SettlementModelCached.getAll.returns([{
      settlementModelId: 1,
      name: 'DEFERREDNET',
      isActive: 1,
      settlementGranularityId: 2,
      settlementInterchangeId: 2,
      settlementDelayId: 2,
      currencyId: null,
      requireLiquidityCheck: 1,
      ledgerAccountTypeId: Enum.Accounts.LedgerAccountType.POSITION,
      settlementAccountTypeId: Enum.Accounts.LedgerAccountType.SETTLEMENT,
      autoPositionReset: 1
    }])
    participantFacade.getParticipantLimitByParticipantCurrencyLimit.returns({
      participantCurrencyId: PAYER_POSITION_ACCOUNT,
      participantLimitTypeId: 1,
      value: 1000,
      isActive: 1,
      createdBy: 'unknown',
      participantLimitId: 1,
      thresholdAlarmPercentage: 0.5
    })

    // Payer position 0; settlement balance -1000 (liquidity cover 1000)
    BatchPositionModel.getPositionsByAccountIdsForUpdate.returns({
      [PAYER_POSITION_ACCOUNT]: { participantPositionId: 7, participantCurrencyId: PAYER_POSITION_ACCOUNT, value: 0, reservedValue: 0 },
      [PAYER_SETTLEMENT_ACCOUNT]: { participantPositionId: 8, participantCurrencyId: PAYER_SETTLEMENT_ACCOUNT, value: -1000, reservedValue: 0 }
    })
    BatchPositionModel.getLatestTransferStateChangesByTransferIdList.returns({
      [T1]: { transferId: T1, transferStateId: State.RECEIVED_PREPARE, transferStateChangeId: 101 },
      [T2]: { transferId: T2, transferStateId: State.RECEIVED_PREPARE, transferStateChangeId: 102 }
    })
    BatchPositionModel.getLatestFxTransferStateChangesByCommitRequestIdList.returns({})
    BatchPositionModel.getTransferInfoList.returns({})
    BatchPositionModel.getReservedPositionChangesByCommitRequestIds.returns({})
    BatchPositionModel.getTransferByIdsForReserve.returns({})
    test.end()
  })

  binProcessorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  binProcessorTest.test('Change 3: transfer states are read after the position rows are locked', async (test) => {
    await BinProcessor.processBins(binsWith(positionMessage(T1)), trx)

    const lockCall = BatchPositionModel.getPositionsByAccountIdsForUpdate.getCall(0)
    const stateReadCall = BatchPositionModel.getLatestTransferStateChangesByTransferIdList.getCall(0)
    const fxStateReadCall = BatchPositionModel.getLatestFxTransferStateChangesByCommitRequestIdList.getCall(0)

    test.ok(lockCall, 'position rows are locked')
    test.ok(stateReadCall, 'transfer states are read')
    test.ok(lockCall && stateReadCall && lockCall.calledBefore(stateReadCall), 'transfer state read happens after the position lock')
    test.ok(lockCall && fxStateReadCall && lockCall.calledBefore(fxStateReadCall), 'FX transfer state read happens after the position lock')
    test.end()
  })

  binProcessorTest.test('Change 2: two copies in one batch reserve the funds once', async (test) => {
    const result = await BinProcessor.processBins(binsWith(positionMessage(T1), positionMessage(T1)), trx)

    test.ok(BatchPositionModel.updateParticipantPosition.calledOnce, 'payer position is updated once')
    test.equal(BatchPositionModel.updateParticipantPosition.getCall(0)?.args[2], AMOUNT, 'payer position goes up by the amount once')

    const stateChanges = BatchPositionModel.bulkInsertTransferStateChanges.getCall(0)?.args[1] || []
    test.deepEqual(
      stateChanges.map(change => [change.transferId, change.transferStateId]),
      [[T1, State.RESERVED]],
      'one RESERVED state change'
    )

    const positionChanges = BatchPositionModel.bulkInsertParticipantPositionChanges.getCall(0)?.args[1] || []
    test.equal(positionChanges.length, 1, 'one participantPositionChange')
    test.equal(result.notifyMessages.length, 1, 'the payee receives the prepare request once')
    test.end()
  })

  binProcessorTest.test('Change 2: a duplicate next to another transfer does not affect it', async (test) => {
    const result = await BinProcessor.processBins(binsWith(positionMessage(T1), positionMessage(T2), positionMessage(T1)), trx)

    test.equal(BatchPositionModel.updateParticipantPosition.getCall(0)?.args[2], 2 * AMOUNT, 'each transfer is reserved once')

    const stateChanges = BatchPositionModel.bulkInsertTransferStateChanges.getCall(0)?.args[1] || []
    test.deepEqual(
      stateChanges.map(change => [change.transferId, change.transferStateId]),
      [[T1, State.RESERVED], [T2, State.RESERVED]],
      'one RESERVED state change per transfer'
    )
    test.equal(result.notifyMessages.length, 2, 'one notification per transfer')
    test.end()
  })

  binProcessorTest.test('Change 1: a position message for an already RESERVED transfer writes nothing', async (test) => {
    BatchPositionModel.getLatestTransferStateChangesByTransferIdList.returns({
      [T1]: { transferId: T1, transferStateId: State.RESERVED, transferStateChangeId: 101 }
    })

    const result = await BinProcessor.processBins(binsWith(positionMessage(T1)), trx)

    const stateChanges = BatchPositionModel.bulkInsertTransferStateChanges.getCall(0)?.args[1] || []
    const positionChanges = BatchPositionModel.bulkInsertParticipantPositionChanges.getCall(0)?.args[1] || []
    test.deepEqual(stateChanges, [], 'no state change (not relabelled ABORTED_REJECTED)')
    test.deepEqual(positionChanges, [], 'no position change')
    test.equal(result.notifyMessages.length, 0, 'no notification to the payer')
    test.end()
  })

  binProcessorTest.end()
})
