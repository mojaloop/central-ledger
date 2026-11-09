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

 * TigerBeetle
 - Lewis Daly <lewis@tigerbeetle.com>
 --------------
 ******/

import assert from 'node:assert'
import { after, before, describe, it } from 'node:test'
import Harness from '../../../testing/harness/harness'
import * as ApiHelpers from '../../../testing/api-helpers'
import { Snapshot } from '../../../testing/snapshot'
import PRNG from '../../../testing/prng'
import { LedgerTigerBeetle } from './ledger-tigerbeetle'
import { SettlementParticipantV2, SettlementUpdateV2 } from '../shared/types'
import { Reporter } from '../shared/reporter'

const harness = Harness.getInstance()
const prng = new PRNG(456)
Harness.injectPrngAndPatchDateGlobal(prng)

let reporter: Reporter

describe('ledger-tigerbeetle', () => {
  before(async () => {
    await harness.up()
    harness.configOverride({ LEDGER: 'TIGERBEETLE' })
    await harness.setupGlobals()

    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('USD')
      .currency('GBP')
      .build()
      .create()
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .name('dfsp_a')
      .currency('USD')
      .build()
      .create()
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .name('dfsp_b')
      .currency('USD')
      .build()
      .create()
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .name('dfsp_c')
      .currency('USD')
      .build()
      .create()

    reporter = new Reporter({ ledger: harness.ledger, config: harness.config })
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('settlement happy path', async () => {
    const ledger = harness.ledger as LedgerTigerBeetle
    const dfsps = ['dfsp_a', 'dfsp_b', 'dfsp_c']
    const currencies = ['USD']

    let balanceSheet = await reporter.balanceSheet(harness.clock.now)
    Snapshot.from(`dfsp_a (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_b (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_c (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    `).checkStringUnwrap(balanceSheet.toTAccounts(dfsps, currencies))

    // Create a bunch of Payments between dfsps.
    await randomPayments(dfsps, currencies, 5)
    harness.clock.tick()
    await ledger.closeSettlementWindow({
      id: 1,
      reason: 'test close',
      now: harness.clock.now
    })
    let responseWindows = await ledger.getSettlementWindows({
      fromDateTime: new Date(0)
    })
    assert(responseWindows.type === 'SUCCESS')
    assert(responseWindows.result.length === 2)

    harness.clock.tick()

    // Make more payments into the second window.
    await randomPayments(dfsps, currencies, 5)
    await ledger.closeSettlementWindow({
      id: 2,
      reason: 'test close',
      now: harness.clock.now
    })

    responseWindows = await ledger.getSettlementWindows({
      fromDateTime: new Date(0)
    })
    assert(responseWindows.type === 'SUCCESS')
    assert(responseWindows.result.length === 3)

    const idsClosed = responseWindows.result
      .filter(window => window.state === 'CLOSED')
      .map(window => window.settlementWindowId)

    // Now prepare a settlement.
    harness.clock.tick()
    const resultPrepareSettlement = await ledger.settlementPrepare({
      windowIds: idsClosed,
      model: 'DEFERRED_MULTILATERAL_NET_USD',
      reason: 'test settlement 1',
      now: harness.clock.now
    })
    assert(resultPrepareSettlement.type === 'SUCCESS')
    assert(resultPrepareSettlement.result.id === 1)
    const settlementId = resultPrepareSettlement.result.id

    // Look it up again.
    let resultGetSettlement = await ledger.getSettlement({
      id: settlementId
    })
    assert(resultGetSettlement.type === 'SUCCESS')
    Snapshot.from(`{
      "id": 1,
      "state": "PENDING_SETTLEMENT",
      "reason": "test settlement 1",
      "createdDate": "2026-02-01T00:00:04.003Z",
      "changedDate": "2026-02-01T00:00:04.003Z",
      "settlementWindows": [
        {
          "settlementWindowId": 1,
          "reason": "test close",
          "openDate": "1970-01-01T00:00:00.000Z",
          "closeDate": "2026-02-01T00:00:03.000Z"
        },
        {
          "settlementWindowId": 2,
          "reason": "test close",
          "openDate": "2026-02-01T00:00:03.001Z",
          "closeDate": "2026-02-01T00:00:03.003Z"
        }
      ],
      "participants": [
        {
          "id": 0,
          "dfsp": "dfsp_a",
          "accounts": [
            {
              "id": "7435909945107525121",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1076.23",
                "currency": "USD"
              }
            },
            {
              "id": "4300986146683360698",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-512.8",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_b",
          "accounts": [
            {
              "id": "6452615883324864107",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-320.77",
                "currency": "USD"
              }
            },
            {
              "id": "5331018451462682808",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1022.54",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_c",
          "accounts": [
            {
              "id": "14326844969439849881",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-755.46",
                "currency": "USD"
              }
            },
            {
              "id": "15348324780932240679",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-509.74",
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(resultGetSettlement.result)

    // Time to settle!
    let updates: Array<SettlementUpdateV2> = [{
      dfspId: 'dfsp_c',
      accountId: 14326844969439849881n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    },
    {
      dfspId: 'dfsp_c',
      accountId: 15348324780932240679n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    }
    ]
    await ledger.settlementUpdate({ id: settlementId, updates })

    // Look it up again.
    resultGetSettlement = await ledger.getSettlement({
      id: settlementId
    })
    assert(resultGetSettlement.type === 'SUCCESS')
    Snapshot.from(`{
      "id": 1,
      "state": "PENDING_SETTLEMENT",
      "reason": "test settlement 1",
      "createdDate": "2026-02-01T00:00:04.003Z",
      "changedDate": "2026-02-01T00:00:04.003Z",
      "settlementWindows": [
        {
          "settlementWindowId": 1,
          "reason": "test close",
          "openDate": "1970-01-01T00:00:00.000Z",
          "closeDate": "2026-02-01T00:00:03.000Z"
        },
        {
          "settlementWindowId": 2,
          "reason": "test close",
          "openDate": "2026-02-01T00:00:03.001Z",
          "closeDate": "2026-02-01T00:00:03.003Z"
        }
      ],
      "participants": [
        {
          "id": 0,
          "dfsp": "dfsp_a",
          "accounts": [
            {
              "id": "7435909945107525121",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1076.23",
                "currency": "USD"
              }
            },
            {
              "id": "4300986146683360698",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-512.8",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_b",
          "accounts": [
            {
              "id": "6452615883324864107",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-320.77",
                "currency": "USD"
              }
            },
            {
              "id": "5331018451462682808",
              "state": "PENDING_SETTLEMENT",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1022.54",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_c",
          "accounts": [
            {
              "id": "14326844969439849881",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-755.46",
                "currency": "USD"
              }
            },
            {
              "id": "15348324780932240679",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-509.74",
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(resultGetSettlement.result)

    // Get all dfsps to PENDING status.
    updates = [{
      dfspId: 'dfsp_a',
      accountId: 7435909945107525121n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    },
    {
      dfspId: 'dfsp_a',
      accountId: 4300986146683360698n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    },
    {
      dfspId: 'dfsp_b',
      accountId: 6452615883324864107n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    },
    {
      dfspId: 'dfsp_b',
      accountId: 5331018451462682808n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    },
    // Same update as before, it's idempotent.
    {
      dfspId: 'dfsp_c',
      accountId: 14326844969439849881n,
      state: 'PS_TRANSFERS_RECORDED',
      reason: 'test',
      externalReference: 'testing'
    }]
    await ledger.settlementUpdate({ id: settlementId, updates })

    // Look it up again.
    resultGetSettlement = await ledger.getSettlement({
      id: settlementId
    })
    assert(resultGetSettlement.type === 'SUCCESS')
    Snapshot.from(`{
      "id": 1,
      "state": "PS_TRANSFERS_RESERVED",
      "reason": "test settlement 1",
      "createdDate": "2026-02-01T00:00:04.003Z",
      "changedDate": "2026-02-01T00:00:04.003Z",
      "settlementWindows": [
        {
          "settlementWindowId": 1,
          "reason": "test close",
          "openDate": "1970-01-01T00:00:00.000Z",
          "closeDate": "2026-02-01T00:00:03.000Z"
        },
        {
          "settlementWindowId": 2,
          "reason": "test close",
          "openDate": "2026-02-01T00:00:03.001Z",
          "closeDate": "2026-02-01T00:00:03.003Z"
        }
      ],
      "participants": [
        {
          "id": 0,
          "dfsp": "dfsp_a",
          "accounts": [
            {
              "id": "7435909945107525121",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1076.23",
                "currency": "USD"
              }
            },
            {
              "id": "4300986146683360698",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-512.8",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_b",
          "accounts": [
            {
              "id": "6452615883324864107",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-320.77",
                "currency": "USD"
              }
            },
            {
              "id": "5331018451462682808",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "1022.54",
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 0,
          "dfsp": "dfsp_c",
          "accounts": [
            {
              "id": "14326844969439849881",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-755.46",
                "currency": "USD"
              }
            },
            {
              "id": "15348324780932240679",
              "state": "PS_TRANSFERS_RESERVED",
              "reason": "",
              "netSettlementAmount": {
                "amount": "-509.74",
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(resultGetSettlement.result)

    await ledger.settlementCommit({ id: settlementId })

    balanceSheet = await reporter.balanceSheet(harness.clock.now)
    Snapshot.from(`dfsp_a (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_b (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_c (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    `).checkStringUnwrap(balanceSheet.toTAccounts(dfsps, currencies))
  })

  it('simplified settlement', async () => {
    const dfsps = ['dfsp_a', 'dfsp_b']
    const currencies = ['USD']

    let balanceSheet = await reporter.balanceSheet(harness.clock.now)

    Snapshot.from(`dfsp_a (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_b (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    `).checkStringUnwrap(balanceSheet.toTAccounts(dfsps, currencies))

    const ledger = harness.ledger as LedgerTigerBeetle

    // Send 100 from a to b.
    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .amount('100.00', 'USD')
      .build()
      .prepareAndFulfil()

    // Lazy create the first settlement window if it doesn't already exist.
    await ledger.closeSettlementWindow({
      id: 1,
      reason: 'test close',
      now: harness.clock.now
    })
    harness.clock.tick()
    let responseWindows = await ledger.getSettlementWindows({ fromDateTime: new Date(0) })
    assert(responseWindows.type === 'SUCCESS')
    const windowToClose = responseWindows.result.find(window => window.state === 'OPEN')
    assert(windowToClose)
    await ledger.closeSettlementWindow({
      id: windowToClose?.settlementWindowId,
      reason: 'test close',
      now: harness.clock.now
    })

    responseWindows = await ledger.getSettlementWindows({ fromDateTime: new Date(0) })

    assert(responseWindows.type === 'SUCCESS')
    assert(responseWindows.result.length >= 2)

    harness.clock.tick()

    // We need to figure out if a settlement window is closed but then settled.
    // The existing implementation puts these things together...
    const idsClosed = responseWindows.result
      .filter(window => window.state === 'CLOSED')
      .map(window => window.settlementWindowId)

    // Prepare a settlement.
    harness.clock.tick()
    const resultPrepareSettlement = await ledger.settlementPrepare({
      windowIds: idsClosed,
      model: 'DEFERRED_MULTILATERAL_NET_USD',
      reason: 'test settlement 1',
      now: harness.clock.now
    })
    assert(resultPrepareSettlement.type === 'SUCCESS')
    const settlementId = resultPrepareSettlement.result.id

    // Look it up again.
    let resultGetSettlement = await ledger.getSettlement({ id: settlementId })
    assert(resultGetSettlement.type === 'SUCCESS')
    const updates: Array<SettlementUpdateV2> = resultGetSettlement.result.participants.map(participantAny => {
      const participant = participantAny as SettlementParticipantV2
      assert(participant.accounts.length === 1)
      return {
        dfspId: participant.dfspId,
        accountId: participant.accounts[0].id,
        state: 'PS_TRANSFERS_RECORDED',
        reason: 'test',
        externalReference: 'testing'
      }
    })
    await ledger.settlementUpdate({ id: settlementId, updates })

    // dfsp_a netSettlementAmount is negative, therefore they must pay the hub.
    // dfsp_b netSettlementAmount is positive, therefore they receive funds from the hub.
    Snapshot.from(`[
      {
        "id": 0,
        "dfsp": "dfsp_a",
        "accounts": [
          {
            "id": :ignore
            "state": "PENDING_SETTLEMENT",
            "reason": "",
            "netSettlementAmount": {
              "amount": "-100",
              "currency": "USD"
            }
          }
        ]
      },
      {
        "id": 0,
        "dfsp": "dfsp_b",
        "accounts": [
          {
            "id": :ignore
            "state": "PENDING_SETTLEMENT",
            "reason": "",
            "netSettlementAmount": {
              "amount": "100",
              "currency": "USD"
            }
          }
        ]
      }
    ]`).checkUnwrap(resultGetSettlement.result.participants)

    const resultCommit = await ledger.settlementCommit({ id: settlementId })
    assert(resultCommit.type === 'SUCCESS')

    // Balances reset to their original.
    balanceSheet = await reporter.balanceSheet(harness.clock.now)
    Snapshot.from(`dfsp_a (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    dfsp_b (USD)                      DR          CR
    ────────────────────────────────────────────────
        asset:Deposit          10,000.00            
    liability:Unrestricted                 10,000.00
    liability:Restricted                            
    liability:Reserved                              
    
    `).checkStringUnwrap(balanceSheet.toTAccounts(dfsps, currencies))
  })
})

const randomPayments = async (
  parties: Array<string>,
  currencies: Array<string>,
  count: number
): Promise<void> => {
  assert(parties.length >= 2)
  assert(currencies.length >= 1)
  assert(count >= 1)

  for (let idx = 0; idx <= count; idx++) {
    const [payer, payee] = prng.randomSampleFrom(parties, 2)
    const currency = prng.randomElementFrom(currencies)
    const amount = (prng.intExclusive(100000) / 100).toFixed(2)
    await ApiHelpers.buildPayment()
      .deps(harness)
      .parties(payer, payee)
      .amount(amount, currency)
      .build()
      // This is quite slow since we're waiting for individual messages.
      // Is there a better way to bypass messaging?
      .prepareAndFulfil()
  }
}
