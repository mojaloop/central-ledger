import assert from "node:assert"
import { after, before, describe, it } from "node:test"
import Harness from '../../testing/harness'
import { Enum, LedgerAccountTypeEnum } from '@mojaloop/central-services-shared'
import ParticipantService from './index'
import { ApplicationConfig } from "../../lib/config/types"
import { Snapshot } from "../../testing/snapshot"
import { createDfsp } from "../../testing/api-helpers"

const harness = Harness.getInstance()

// Test data:
const dfsps = ['dfspa', 'dfspb', 'dfspc', 'dfspd']
const proxyStatus = [false, false, false, true]
const currencies = ['USD', 'KES']
const accountTypes: Array<LedgerAccountTypeEnum> = [
  Enum.Accounts.LedgerAccountType.POSITION,
  Enum.Accounts.LedgerAccountType.SETTLEMENT
]

describe('domain/participant/index', () => {
  let config: ApplicationConfig

  before(async () => {
    await harness.up()
    await harness.setupGlobals()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('creates the hub accounts', async () => {
    let exists = await ParticipantService.hubAccountExists(
      'USD',
      Enum.Accounts.LedgerAccountType.HUB_RECONCILIATION
    )
    assert.equal(exists, false)

    let newAccount = await ParticipantService.createHubAccount(
      harness.config.HUB_ID, 'USD', Enum.Accounts.LedgerAccountType.HUB_RECONCILIATION
    )
    assert(newAccount.participantCurrency)
    assert(newAccount.participantPosition)

    exists = await ParticipantService.hubAccountExists(
      'USD',
      Enum.Accounts.LedgerAccountType.HUB_MULTILATERAL_SETTLEMENT
    )
    assert.equal(exists, false)
    newAccount = await ParticipantService.createHubAccount(
      harness.config.HUB_ID, 'USD', Enum.Accounts.LedgerAccountType.HUB_MULTILATERAL_SETTLEMENT
    )
    assert(newAccount.participantCurrency)
    assert(newAccount.participantPosition)
  })

  it('creates the participants', async (test) => {
    assert(dfsps.length === proxyStatus.length)

    for (const [idx, dfsp] of dfsps.entries()) {
      const isProxy = proxyStatus[idx]
      const resultGetByName = await ParticipantService.getByName(dfsp)
      assert.equal(resultGetByName, undefined)

      const participantId = await ParticipantService.create({
        name: dfsp, isProxy,
      })
      for (const currency of currencies) {
        for (const accountType of accountTypes) {
          await ParticipantService.createParticipantCurrency(
            participantId,
            currency,
            accountType,
            false
          )
        }
      }

      const created = await ParticipantService.getById(participantId)
      Snapshot.from(`{
        "participantId": ${participantId},
        "name": "${dfsp}",
        "description": null,
        "isActive": 1,
        "createdDate": :ignore
        "createdBy": "unknown",
        "isProxy": ${isProxy ? '1' : '0'},
        "currencyList": [
          {
            "participantCurrencyId": :int,
            "participantId": ${participantId},
            "currencyId": "USD",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": :ignore
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": :int,
            "participantId": ${participantId},
            "currencyId": "USD",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": :ignore
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": :int,
            "participantId": ${participantId},
            "currencyId": "KES",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": :ignore
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": :int,
            "participantId": ${participantId},
            "currencyId": "KES",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": :ignore
            "createdBy": "unknown"
          }
        ]
      }`).checkStringUnwrap(JSON.stringify(created, null, 2))
    }
  })

  it('getAll()', async () => {
    const result = await ParticipantService.getAll()
    Snapshot.from(`[
      {
        "participantId": 2,
        "name": "dfspa",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "currencyList": [
          {
            "participantCurrencyId": 3,
            "participantId": 2,
            "currencyId": "USD",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 4,
            "participantId": 2,
            "currencyId": "USD",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 5,
            "participantId": 2,
            "currencyId": "KES",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 6,
            "participantId": 2,
            "currencyId": "KES",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          }
        ]
      },
      {
        "participantId": 3,
        "name": "dfspb",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "currencyList": [
          {
            "participantCurrencyId": 7,
            "participantId": 3,
            "currencyId": "USD",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 8,
            "participantId": 3,
            "currencyId": "USD",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 9,
            "participantId": 3,
            "currencyId": "KES",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 10,
            "participantId": 3,
            "currencyId": "KES",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          }
        ]
      },
      {
        "participantId": 4,
        "name": "dfspc",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "currencyList": [
          {
            "participantCurrencyId": 11,
            "participantId": 4,
            "currencyId": "USD",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 12,
            "participantId": 4,
            "currencyId": "USD",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 13,
            "participantId": 4,
            "currencyId": "KES",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 14,
            "participantId": 4,
            "currencyId": "KES",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          }
        ]
      },
      {
        "participantId": 5,
        "name": "dfspd",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 1,
        "currencyList": [
          {
            "participantCurrencyId": 15,
            "participantId": 5,
            "currencyId": "USD",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 16,
            "participantId": 5,
            "currencyId": "USD",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 17,
            "participantId": 5,
            "currencyId": "KES",
            "ledgerAccountTypeId": 1,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 18,
            "participantId": 5,
            "currencyId": "KES",
            "ledgerAccountTypeId": 2,
            "isActive": 0,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          }
        ]
      },
      {
        "participantId": 1,
        "name": "Hub",
        "description": "Hub Operator",
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "seeds",
        "isProxy": 0,
        "currencyList": [
          {
            "participantCurrencyId": 1,
            "participantId": 1,
            "currencyId": "USD",
            "ledgerAccountTypeId": 3,
            "isActive": 1,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          },
          {
            "participantCurrencyId": 2,
            "participantId": 1,
            "currencyId": "USD",
            "ledgerAccountTypeId": 4,
            "isActive": 1,
            "createdDate": ":ignore",
            "createdBy": "unknown"
          }
        ]
      }
    ]`).checkUnwrap(result)
  })

  it('getById()', async () => {
    // Just look for a single participantId.
    const result = await ParticipantService.getById(3)
    Snapshot.from(`{
      "participantId": 3,
      "name": "dfspb",
      "description": null,
      "isActive": 1,
      "createdDate": ":ignore",
      "createdBy": "unknown",
      "isProxy": 0,
      "currencyList": [
        {
          "participantCurrencyId": 7,
          "participantId": 3,
          "currencyId": "USD",
          "ledgerAccountTypeId": 1,
          "isActive": 0,
          "createdDate": ":ignore",
          "createdBy": "unknown"
        },
        {
          "participantCurrencyId": 8,
          "participantId": 3,
          "currencyId": "USD",
          "ledgerAccountTypeId": 2,
          "isActive": 0,
          "createdDate": ":ignore",
          "createdBy": "unknown"
        },
        {
          "participantCurrencyId": 9,
          "participantId": 3,
          "currencyId": "KES",
          "ledgerAccountTypeId": 1,
          "isActive": 0,
          "createdDate": ":ignore",
          "createdBy": "unknown"
        },
        {
          "participantCurrencyId": 10,
          "participantId": 3,
          "currencyId": "KES",
          "ledgerAccountTypeId": 2,
          "isActive": 0,
          "createdDate": ":ignore",
          "createdBy": "unknown"
        }
      ]
    }`).checkUnwrap(result)
  })

  it('addEndpoint() and getAllEndpoints()', async () => {
    for (const dfsp of dfsps) {
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_TRANSFER_POST,
        value: `http://localhost:1080/transfers`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_TRANSFER_PUT,
        value: `http://localhost:1080/transfers/{{transferId}}`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_TRANSFER_ERROR,
        value: `http://localhost:1080/transfers/{{transferId}}/error`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST,
        value: `http://localhost:1080/bulkTransfers`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT,
        value: `http://localhost:1080/bulkTransfers/{{id}}`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR,
        value: `http://localhost:1080//bulkTransfers/{{id}}/error`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES,
        value: `http://localhost:1080`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_AUTHORIZATIONS,
        value: `http://localhost:1080`
      })
      await ParticipantService.addEndpoint(dfsp, {
        type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE,
        value: `http://localhost:1080`
      })

      const endpoints = await ParticipantService.getAllEndpoints(dfsp)
      assert.equal(endpoints.length, 9)
    }
  })

  it('getEndpoint()', async () => {
    // Spot check a a single endpoint for a single participant.
    const result = await ParticipantService.getEndpoint(
      'dfspd', Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_TRANSFER_PUT
    )
    Snapshot.from(`[
      {
        "participantEndpointId": 29,
        "participantId": 5,
        "endpointTypeId": 4,
        "value": "http://localhost:1080/transfers/{{transferId}}",
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "name": "FSPIOP_CALLBACK_URL_TRANSFER_PUT"
      }
    ]`).checkUnwrap(result)
  })

  it('Gets no endpoint when the endpoint doesn\'t exist',
    { expectFailure: /participant not found/ },
    async () => {
      await ParticipantService.getEndpoint(
        'dfsp_nope', Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES
      )
    })

  it('destroyParticipantEndpointByName() deletes an existing endpoint', async () => {
    const name = 'tmp_dfsp_1'
    // Create a new DFSP we can ignore in other tests
    await createDfsp(harness, {
      name,
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    await ParticipantService.addEndpoint(name, {
      type: Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES,
      value: `http://localhost:1080`
    })
    let result = await ParticipantService.getEndpoint(
      name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES
    )
    assert(result, 'Expected endpoint to exist')
    assert.equal(result.length, 1, 'Expected dfsp to have exactly 1 endpoint.')

    // Destroy endpoints.
    result = await ParticipantService.destroyParticipantEndpointByName(name)
    assert.equal(result, 1, 'Expected 1 endpoint to be deleted.')

    // Check if it exists still.
    result = await ParticipantService.getEndpoint(
      name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_QUOTES
    )
    assert(Array.isArray(result), 'Expected result to be an array.')
    assert.equal(result.length, 0, 'Expected dfsp to have exactly 0 endpoints.')

    // Try and delete again!
    result = await ParticipantService.destroyParticipantEndpointByName(name)
    assert.equal(result, 0, 'Expected 0 endpoints to be deleted.')
  })

  // TODO: This fails with an SQL error. We should fix this in the next pass (after rewriting the 
  //       integration tests).
  it.skip('addLimitAndInitialPosition() when the dfsp does not exist', async () => {
    const payload = {}
    await ParticipantService.addLimitAndInitialPosition('nope_dsp', payload)
  })

  it('addLimitAndInitialPosition() for each dfsp', async () => {
    for (const dfsp of dfsps) {
      for (const currency of currencies) {
        const payload = {
          currency,
          limit: {
            type: 'NET_DEBIT_CAP',
            value: 10000000
          },
          initialPosition: 0
        }
        const mark = harness.redpandaMark()
        const result = await ParticipantService.addLimitAndInitialPosition(dfsp, payload)
        assert.equal(result, true)
        await harness.redpandaDrain(mark, 1)
      }
    }

    // Now check the positions and limits for each dfsp (ignoring tmp_dfsp from other tests).
    const positions = (await ParticipantService.getLimitsForAllParticipants({
      currency: 'USD', type: 'NET_DEBIT_CAP'
    })).filter((dfsp: any) => dfsp.name.match(/^dfsp.*/))
    Snapshot.from(`[
      {
        "participantId": 2,
        "name": "dfspa",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "participantCurrencyId": :ignore
        "currencyId": "USD",
        "ledgerAccountTypeId": 1,
        "participantLimitId": :ignore
        "participantLimitTypeId": 1,
        "value": "10000000.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "limitType": "NET_DEBIT_CAP"
      },
      {
        "participantId": 3,
        "name": "dfspb",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "participantCurrencyId": :ignore
        "currencyId": "USD",
        "ledgerAccountTypeId": 1,
        "participantLimitId": :ignore
        "participantLimitTypeId": 1,
        "value": "10000000.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "limitType": "NET_DEBIT_CAP"
      },
      {
        "participantId": 4,
        "name": "dfspc",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 0,
        "participantCurrencyId": :ignore
        "currencyId": "USD",
        "ledgerAccountTypeId": 1,
        "participantLimitId": :ignore
        "participantLimitTypeId": 1,
        "value": "10000000.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "limitType": "NET_DEBIT_CAP"
      },
      {
        "participantId": 5,
        "name": "dfspd",
        "description": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "isProxy": 1,
        "participantCurrencyId": :ignore
        "currencyId": "USD",
        "ledgerAccountTypeId": 1,
        "participantLimitId": :ignore
        "participantLimitTypeId": 1,
        "value": "10000000.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "limitType": "NET_DEBIT_CAP"
      }
    ]`).checkUnwrap(positions);
  })

  // TODO: This fails with an SQL error. We should fix this in the next pass (after rewriting the 
  //       integration tests).
  it.skip('addLimitAndInitialPosition() tries to set the position to negative',
    { expectFailure: /position must be >= 0/ },
    async () => {
      const name = 'dfsp_tmp_2'
      // Create a new DFSP we can ignore in other tests
      await createDfsp(harness, {
        name,
        currencies: ['USD'],
        isProxy: false,
        initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
        deposits: [10000]
      })
      const payload = {
        currency: 'USD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 10000000
        },
        initialPosition: -100
      }

      const result = await ParticipantService.addLimitAndInitialPosition(name, payload)
      console.log(result);
    })

  it('adjustLimit() changes the limit', async () => {
    const name = 'tmp_dfsp_3'
    await createDfsp(harness, {
      name,
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })

    const result = await ParticipantService.adjustLimits(name, {
      currency: 'USD',
      limit: { type: 'NET_DEBIT_CAP', value: 9999 }
    })
    Snapshot.from(`{
      "participantLimit": {
        "participantCurrencyId": :ignore,
        "participantLimitTypeId": 1,
        "value": 9999,
        "isActive": 1,
        "createdBy": "unknown",
        "participantLimitId": :ignore
      }
    }`).checkUnwrap(result);

    // Get limit by currency.
    const resultByCurrency = await ParticipantService.getLimits(name, { currency: 'USD' })

    Snapshot.from(`[
      {
        "participantLimitId": :ignore,
        "participantCurrencyId": 21,
        "participantLimitTypeId": 1,
        "value": "9999.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "name": "NET_DEBIT_CAP"
      }
    ]`).checkUnwrap(resultByCurrency);

    // Get limit by type.
    const resultByType = await ParticipantService.getLimits(name, { type: 'NET_DEBIT_CAP' })
    Snapshot.from(`[
      {
        "participantLimitId": :ignore,
        "participantCurrencyId": 21,
        "participantLimitTypeId": 1,
        "value": "9999.0000",
        "thresholdAlarmPercentage": "10.00",
        "startAfterParticipantPositionChangeId": null,
        "isActive": 1,
        "createdDate": ":ignore",
        "createdBy": "unknown",
        "name": "NET_DEBIT_CAP",
        "currencyId": "USD"
      }
    ]`).checkUnwrap(resultByType);
  })

  it('getPositions() ', async () => {
    const name = 'tmp_dfsp_4'
    await createDfsp(harness, {
      name,
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [{ initialPosition: 0, value: 100000 }],
      deposits: [10000]
    })
    const response = await ParticipantService.getPositions(name, {
      currency: 'USD'
    })
    Snapshot.from(`{
      "currency": "USD",
      "value": "0.0000",
      "changedDate": ":ignore"
    }`).checkUnwrap(response)
  })
})
