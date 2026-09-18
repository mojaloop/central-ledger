import { after, before, describe, it } from 'node:test'
import Harness from '../testing/harness'
import * as ApiHelpers from '../testing/api-helpers'
import { unwrapResponseSettlement } from '../testing/util'
import assert from 'node:assert'
import { Snapshot } from '../testing/snapshot'
import { logger } from '../shared/logger'
import PRNG from '../testing/prng'
import HandlerSettlementV2 from './handler-v2'

const harness = Harness.getInstance()
const prng = new PRNG(456)
Harness.injectPrngAndPatchDateGlobal(prng)

let requestTemplate: any
let handlerV2: HandlerSettlementV2
describe('settlement api handlers', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    handlerV2 = new HandlerSettlementV2({
      config: harness.config,
      ledger: harness.ledger
    })

    // Settlement API works slightly differently to the Admin API. We need to pass these in as
    // Hapi.server context.
    requestTemplate = {
      headers: {
        'fspiop-source': 'client',
        'fspiop-destination': 'hub',
      },
      span: {
        setTags: () => { },
        audit: async () => { }
      },
      server: {
        log: (level: string, message: string | Error) => {
          const logFn = logger[level as keyof typeof logger]
          if (typeof logFn === 'function') {
            (logFn as (msg: string | Error) => void).call(logger, message)
          } else {
            logger.info(message)
          }
        },
        methods: {
          enums: (name: string) => harness.enums[name]
        }
      }
    }

    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('USD')
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
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('queries a settlement when none exist', async () => {
    const request = {
      ...requestTemplate,
      query: {
        currency: 'USD'
      },
    }
    const {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.getSettlementByParams(request, reply))

    assert.equal(code, 400)
    assert.deepStrictEqual(
      body,
      'No settlements found matching the provided parameters: {"currency":"USD"}'
    )
  })

  it('creates and queries a settlement', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .transferId('10000001')
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .transferId('10000002')
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const request = {
      ...requestTemplate,
      payload: {
        settlementModel: 'DEFERRED_MULTILATERAL_NET_USD',
        reason: 'Test settlement',
        settlementWindows: windows.map(id => ({ id })),
      },
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.createSettlementEvent(request, reply))

    assert.equal(code, 200)
    Snapshot.from(`{
      "id": 1,
      "settlementModel": "DEFERRED_MULTILATERAL_NET_USD",
      "state": "PENDING_SETTLEMENT",
      "reason": "Test settlement",
      "createdDate": "2026-01-31T23:00:00.000Z",
      "changedDate": "2026-01-31T23:00:00.000Z",
      "settlementWindows": [
        {
          "id": 1,
          "state": "PENDING_SETTLEMENT",
          "reason": "Test settlement",
          "createdDate": "2026-02-01T00:00:00.000Z",
          "changedDate": "2026-01-31T23:00:00.000Z",
          "content": [
            {
              "id": 1,
              "state": "PENDING_SETTLEMENT",
              "ledgerAccountType": "POSITION",
              "currencyId": "USD",
              "createdDate": "2026-02-01T00:00:00.000Z",
              "changedDate": "2026-01-31T23:00:00.000Z"
            }
          ]
        }
      ],
      "participants": [
        {
          "id": 2,
          "accounts": [
            {
              "id": 3,
              "state": "PENDING_SETTLEMENT",
              "reason": "Test settlement",
              "netSettlementAmount": {
                "amount": 0,
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 3,
          "accounts": [
            {
              "id": 5,
              "state": "PENDING_SETTLEMENT",
              "reason": "Test settlement",
              "netSettlementAmount": {
                "amount": 0,
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(body)
  })

  it('creates a settlement for an unknown settlementModel name', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .transferId('10000001')
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .transferId('10000002')
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const request = {
      ...requestTemplate,
      payload: {
        settlementModel: 'UNKNOWN_SETTLEMENT_MODEL',
        reason: 'Test settlement',
        settlementWindows: windows.map(id => ({ id })),
      },
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.createSettlementEvent(request, reply))

    assert.equal(code, 400)
    assert.deepEqual(body, "Settlement model not found: UNKNOWN_SETTLEMENT_MODEL")
  })

  it('creates a settlement with invalid settlement windows', async () => {
    const request = {
      ...requestTemplate,
      payload: {
        settlementModel: 'DEFERRED_MULTILATERAL_NET_USD',
        reason: 'Test settlement',
        settlementWindows: [{ id: 945 }, { id: 946 }]
      },
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.createSettlementEvent(request, reply))

    assert.equal(code, 400)
    assert.deepEqual(body, "Inapplicable windows 945, 946")
  })

  it('queries a settlement window', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    const request = {
      ...requestTemplate,
      query: {
        currency: 'USD'
      }
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.getSettlementWindowsByParams(request, reply))

    assert.equal(code, 200)
    // Check only a subset for test isolation.
    Snapshot.from(`[
      {
        "settlementWindowId": :ignore
        "state": "OPEN",
        "reason": :ignore
        "createdDate": :ignore
        "changedDate": :ignore
        "content": []
      }
    ]`).checkUnwrap(body.filter((window: any) => window.state === 'OPEN'))
  })

  it('fails to query a settlement window', async () => {
    const request = {
      ...requestTemplate,
      query: {
        currency: 'XXX'
      }
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.getSettlementWindowsByParams(request, reply))

    assert.equal(code, 400)
    Snapshot.from(`"settlementWindow by filters: {currency:XXX} not found"`).checkUnwrap(body)
  })

  it('closes a settlement window', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    const windows = await ApiHelpers.getOpenSettlementWindows(harness)
    const window = windows[0]
    const request = {
      ...requestTemplate,
      params: {
        id: window.settlementWindowId,
      },
      payload: {
        reason: 'Test close'
      }
    }
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.closeSettlementWindow(request, reply))

    assert.equal(code, 200)
    Snapshot.from(`{
      "settlementWindowId": ${window.settlementWindowId + 1},
      "state": "OPEN",
      "reason": "Test close",
      "createdDate": "2026-02-01T00:00:00.000Z",
      "changedDate": "2026-02-01T00:00:00.000Z"
    }`).checkUnwrap(body)
  })

  it('fails to close an already closed settlement window', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    const windows = await ApiHelpers.getOpenSettlementWindows(harness)
    const window = windows[0]
    const request = {
      ...requestTemplate,
      params: {
        id: window.settlementWindowId,
      },
      payload: {
        reason: 'Test close'
      }
    }
    // First time.
    await unwrapResponseSettlement((reply) => handlerV2.closeSettlementWindow(request, reply))
    // Second time.
    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.closeSettlementWindow(request, reply))

    assert.equal(code, 400)
    Snapshot.from(`"Window ${window.settlementWindowId} is not open"`).checkUnwrap(body)
  })

  it('gets a settlement window after closing', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_b', 'dfsp_a')
      .build()
      .prepareAndFulfil()

    const windows = await ApiHelpers.getOpenSettlementWindows(harness)
    const window = windows[0]
    let request = {
      ...requestTemplate,
      params: {
        id: window.settlementWindowId,
      },
      payload: {
        reason: 'Test close'
      }
    }
    await unwrapResponseSettlement((reply) => handlerV2.closeSettlementWindow(request, reply))
    request = {
      ...requestTemplate,
      params: {
        id: window.settlementWindowId,
      }
    }

    let {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.getSettlementWindowById(request, reply))

    assert.equal(code, 200)
    Snapshot.from(`{
      "settlementWindowId": ${window.settlementWindowId},
      "state": "CLOSED",
      "reason": "Test close",
      "createdDate": "2026-02-01T00:00:00.000Z",
      "changedDate": "2026-02-01T00:00:00.000Z",
      "content": [
        {
          "id": :ignore
          "state": "CLOSED",
          "ledgerAccountType": "POSITION",
          "currencyId": "USD",
          "createdDate": "2026-02-01T00:00:00.000Z",
          "changedDate": "2026-02-01T00:00:00.000Z",
          "settlementId": null
        }
      ]
    }`).checkUnwrap(body)
  })

  it('gets a settlement by id', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_c')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_c', 'dfsp_b')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const settlement = await ApiHelpers.createSettlement(harness, windows)
    const request = {
      ...requestTemplate,
      params: {
        id: settlement.id,
      }
    }
    const {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.getSettlementById(request, reply))
    assert.equal(code, 200)
    Snapshot.from(`{
      "id": ${settlement.id},
      "state": "PENDING_SETTLEMENT",
      "reason": "Test Settlement.",
      "createdDate": "2026-01-31T23:00:00.000Z",
      "changedDate": "2026-01-31T23:00:00.000Z",
      "settlementWindows": [
        {
          "id": :ignore,
          "state": "PENDING_SETTLEMENT",
          "reason": "Test Settlement.",
          "createdDate": "2026-02-01T00:00:00.000Z",
          "changedDate": "2026-01-31T23:00:00.000Z",
          "content": [
            {
              "id": :ignore,
              "state": "PENDING_SETTLEMENT",
              "ledgerAccountType": "POSITION",
              "currencyId": "USD",
              "createdDate": "2026-02-01T00:00:00.000Z",
              "changedDate": "2026-01-31T23:00:00.000Z"
            }
          ]
        }
      ],
      "participants": [
        {
          "id": 2,
          "accounts": [
            {
              "id": 3,
              "state": "PENDING_SETTLEMENT",
              "reason": "Test Settlement.",
              "netSettlementAmount": {
                "amount": 200,
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 3,
          "accounts": [
            {
              "id": 5,
              "state": "PENDING_SETTLEMENT",
              "reason": "Test Settlement.",
              "netSettlementAmount": {
                "amount": -200,
                "currency": "USD"
              }
            }
          ]
        },
        {
          "id": 4,
          "accounts": [
            {
              "id": 7,
              "state": "PENDING_SETTLEMENT",
              "reason": "Test Settlement.",
              "netSettlementAmount": {
                "amount": 0,
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(body)
  })

  it('updates a settlement', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_c')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_c', 'dfsp_b')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const settlement = await ApiHelpers.createSettlement(harness, windows)
    const request = {
      ...requestTemplate,
      params: {
        id: settlement.id,
      },
      payload: {
        participants: [
          {
            id: settlement.participants[0].id,
            accounts: [
              {
                id: settlement.participants[0].accounts[0].id,
                state: 'PS_TRANSFERS_RECORDED',
                reason: 'Settlement transfer recorded',
                externalReference: 'tr123456789',
              }
            ]
          }
        ]
      }
    }
    const {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.updateSettlementById(request, reply))

    assert.equal(code, 200)
    Snapshot.from(`{
      "id": :ignore
      "state": "PENDING_SETTLEMENT",
      "createdDate": "2026-01-31T23:00:00.000Z",
      "settlementWindows": [
        {
          "id": :ignore
          "state": "PENDING_SETTLEMENT",
          "reason": "Test Settlement.",
          "createdDate": "2026-02-01T00:00:00.000Z",
          "changedDate": "2026-01-31T23:00:00.000Z",
          "content": [
            {
              "id": :ignore
              "state": "PENDING_SETTLEMENT",
              "ledgerAccountType": "POSITION",
              "currencyId": "USD",
              "createdDate": "2026-02-01T00:00:00.000Z",
              "changedDate": "2026-01-31T23:00:00.000Z"
            }
          ]
        }
      ],
      "participants": [
        {
          "id": 2,
          "accounts": [
            {
              "id": 3,
              "state": "PS_TRANSFERS_RECORDED",
              "reason": "Settlement transfer recorded",
              "externalReference": "tr123456789",
              "createdDate": "2026-02-01 00:00:00.000",
              "netSettlementAmount": {
                "amount": "200.0000",
                "currency": "USD"
              }
            }
          ]
        }
      ]
    }`).checkUnwrap(body)
  })

  // Note: This seemed unimplemented in central-settlements.
  it('aborts a settlement', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_c')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_c', 'dfsp_b')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const settlement = await ApiHelpers.createSettlement(harness, windows)
    const request = {
      ...requestTemplate,
      params: {
        id: settlement.id
      },
      payload: {
        state: 'ABORTED',
        reason: 'Test abort.'
      }
    }
    const {
      body, code
    } = await unwrapResponseSettlement((reply) => handlerV2.updateSettlementById(request, reply))

    assert.equal(code, 400)
    Snapshot.from(
      `"Unhandled state: PENDING_SETTLEMENT for settlement '4'. Aborting is not allowed."`
    ).checkUnwrap(body)
  })

  it('completes the settlement', async () => {
    // Create some transfers.
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_b')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_a', 'dfsp_c')
      .build()
      .prepareAndFulfil()
    await ApiHelpers
      .buildPayment()
      .deps(harness)
      .parties('dfsp_c', 'dfsp_b')
      .build()
      .prepareAndFulfil()

    // Close the settlement window.
    const windows = await ApiHelpers.closeSettlementWindow(harness)
    const settlement = await ApiHelpers.createSettlement(harness, windows)

    // Convenience function to build the put payload.
    const buildRequest = (
      settlement: Awaited<ReturnType<typeof ApiHelpers.createSettlement>>,
      accountStates: Array<string>
    ): any => {
      assert(settlement.participants.length === accountStates.length)
      const participants = settlement.participants.map((participant, idx) => {
        assert(participant.accounts.length === 1, 'Expected only 1 account for participant.')
        return {
          id: participant.id,
          accounts: [
            {
              id: participant.accounts[0].id,
              state: accountStates[idx],
              reason: 'Settlement transfer recorded',
              externalReference: 'tr123456789',
            }
          ]
        }
      })

      return {
        ...requestTemplate,
        params: {
          id: settlement.id,
        },
        payload: {
          participants
        }
      }
    }

    // Convenience function to send the put payload and check the states of the settlement.
    const putSettlementAndCheck = async (
      request: any,
      expectedAccountStates: Array<string>,
      expectedSettlementState: string
    ) => {
      let response = await unwrapResponseSettlement(
        (reply) => handlerV2.updateSettlementById(request, reply)
      )
      assert.equal(response.code, 200)
      let settlementUpdated = await ApiHelpers.getSettlement(harness, settlement.id)
      const accountStates = settlementUpdated.participants
        .map(participant => participant.accounts[0].state)
      assert.deepStrictEqual(accountStates, expectedAccountStates)
      assert.deepStrictEqual(settlementUpdated.state, expectedSettlementState)
    }

    // Step through the states in one request after another.
    let request = buildRequest(settlement, [
      "PS_TRANSFERS_RECORDED", "PS_TRANSFERS_RECORDED", "PS_TRANSFERS_RECORDED"
    ])
    await putSettlementAndCheck(
      request,
      ["PS_TRANSFERS_RECORDED", "PS_TRANSFERS_RECORDED", "PS_TRANSFERS_RECORDED"],
      'PS_TRANSFERS_RECORDED'
    )
    request = buildRequest(settlement, [
      "PS_TRANSFERS_RESERVED", "PS_TRANSFERS_RESERVED", "PS_TRANSFERS_RESERVED"
    ])
    await putSettlementAndCheck(
      request,
      ["PS_TRANSFERS_RESERVED", "PS_TRANSFERS_RESERVED", "PS_TRANSFERS_RESERVED"],
      'PS_TRANSFERS_RESERVED'
    )
    request = buildRequest(settlement, [
      "PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED"
    ])
    await putSettlementAndCheck(
      request,
      ["PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED"],
      'PS_TRANSFERS_COMMITTED'
    )
    request = buildRequest(settlement, [
      "SETTLED", "PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED"
    ])
    await putSettlementAndCheck(
      request,
      ["SETTLED", "PS_TRANSFERS_COMMITTED", "PS_TRANSFERS_COMMITTED"],
      'SETTLING'
    )
    request = buildRequest(settlement, [
      "SETTLED", "SETTLED", "SETTLED"
    ])
    await putSettlementAndCheck(
      request,
      ["SETTLED", "SETTLED", "SETTLED"],
      'SETTLED'
    )
  })
})