import assert from "node:assert"
import { after, before, describe, it } from "node:test"
import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'
import HandlerV2, {
  RequestAddEndpoint,
  RequestAddLimitAndInitialPosition,
  RequestAdjustLimits,
  RequestCreate,
  RequestCreateHubAccount,
  RequestGetAccounts,
  RequestGetAll,
  RequestGetByName,
  RequestGetLimits,
  RequestGetLimitsForAllParticipants,
  RequestGetPositions,
  RequestRecordFunds,
  RequestUpdate,
  RequestUpdateAccount
} from "./handler-v2"
import { envOrDefaultString, unwrapResponse, unwrapResponseWithError } from "../../testing/util"
import PRNG from "../../testing/prng"
import { logger } from "../../shared/logger"

const harness = Harness.getInstance()
const prng = new PRNG(123)
Harness.injectPrngAndPatchDateGlobal(prng)
let handler: HandlerV2

describe('api/participants/handler-v2', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    handler = new HandlerV2({
      config: harness.config,
      ledger: harness.ledger
    })

    const apiModeAdmin = envOrDefaultString('API_MODE_ADMIN', 'NONE') as 'NONE' | 'LEDGER'
    harness.configOverride({
      API_MODE_ADMIN: apiModeAdmin
    })
    logger.warn(`API_MODE_ADMIN: ${harness.config.API_MODE_ADMIN}`)

    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('AUD')
      .build()
      .create()
    await ApiHelpers.buildHub()
      .deps(harness)
      .currency('EUR')
      .build()
      .create()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('create() creates a dfsp', async () => {
    const requestCreate = {
      payload: {
        name: 'dfsp_a',
        currency: 'AUD',
      }
    } as RequestCreate

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.create(
      requestCreate, reply
    ))

    assert.equal(responseCode, 201)
    Snapshot.from(`{
      "name": "dfsp_a",
      "id": "http://central-ledger/participants/dfsp_a",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 1,
      "links": {
        "self": "http://central-ledger/participants/dfsp_a"
      },
      "accounts": [
        {
          "id": :ignore,
          "ledgerAccountType": "POSITION",
          "currency": "AUD",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "SETTLEMENT",
          "currency": "AUD",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)

    // Ensure that the accounts.dates are strings, not dates (doesn't get picked up by snapshot).
    assert(responseBody.created instanceof Date)
    responseBody.accounts.forEach((acc: any) => {
      assert(acc.createdDate instanceof Date)
    })
  })

  it('create() creates a dfsp twice', async () => {
    const requestCreate = {
      payload: {
        name: 'dfsp_b',
        currency: 'AUD',
      }
    } as RequestCreate

    // First time.
    await unwrapResponse((reply: any) => handler.create(requestCreate, reply))

    // Second time
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.create(
      requestCreate, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3000",
        "errorDescription": "Generic client error - Participant currency has already been registered"
      }
    }`).checkUnwrap(responseBody)
  })

  it('registers an additional currency', async () => {
    let requestCreate = {
      payload: {
        name: 'dfsp_c',
        currency: 'AUD',
      }
    } as RequestCreate

    // First time.
    await unwrapResponse((reply: any) => handler.create(requestCreate, reply))

    requestCreate = {
      payload: {
        name: 'dfsp_c',
        currency: 'EUR',
      }
    } as RequestCreate
    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.create(
      requestCreate, reply
    ))

    assert.equal(responseCode, 201)
    Snapshot.from(`{
      "name": "dfsp_c",
      "id": "http://central-ledger/participants/dfsp_c",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 1,
      "links": {
        "self": "http://central-ledger/participants/dfsp_c"
      },
      "accounts": [
        {
          "id": :ignore,
          "ledgerAccountType": "POSITION",
          "currency": "AUD",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "SETTLEMENT",
          "currency": "AUD",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "POSITION",
          "currency": "EUR",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "SETTLEMENT",
          "currency": "EUR",
          "isActive": 0,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)
  })

  it('create() tries to register for a currency that does not exist', async () => {
    const requestCreate = {
      payload: {
        name: 'dfsp_d',
        currency: 'USD',
      }
    } as RequestCreate

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.create(
      requestCreate, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3003",
        "errorDescription": "Add Party information error - Hub reconciliation account for the specified currency does not exist"
      }
    }`).checkUnwrap(responseBody)
  })

  it.only('createHubAccount() creates a new hub account', async () => {
    const requestCreate = {
      payload: {
        currency: 'BWP',
        type: 'HUB_MULTILATERAL_SETTLEMENT'
      },
      params: {
        name: 'Hub'
      }
    } as RequestCreateHubAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))

    assert.equal(responseCode, 201)
    Snapshot.from(`{
      "name": "Hub",
      "id": "http://central-ledger/participants/Hub",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 1,
      "links": {
        "self": "http://central-ledger/participants/Hub"
      },
      "accounts": [
        {
          "id": :ignore,
          "ledgerAccountType": "HUB_MULTILATERAL_SETTLEMENT",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "HUB_RECONCILIATION",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "HUB_MULTILATERAL_SETTLEMENT",
          "currency": "EUR",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "HUB_RECONCILIATION",
          "currency": "EUR",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore,
          "ledgerAccountType": "HUB_MULTILATERAL_SETTLEMENT",
          "currency": "BWP",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)
  })

  it('createHubAccount() creates a new hub account twice', async () => {
    const requestCreate = {
      payload: {
        currency: 'EGP',
        type: 'HUB_RECONCILIATION'
      },
      params: {
        name: 'Hub'
      }
    } as RequestCreateHubAccount


    // First
    await unwrapResponse((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))
    // Second
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3003",
        "errorDescription": "Add Party information error - Hub account has already been registered."
      }
    }`).checkUnwrap(responseBody)
  })

  it('createHubAccount() creates a new hub account for an invalid currency', async () => {
    const requestCreate = {
      payload: {
        currency: 'lajsdalksjd',
        type: 'HUB_MULTILATERAL_SETTLEMENT'
      },
      params: {
        name: 'Hub'
      }
    } as RequestCreateHubAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - insert into \`participantCurrency\` (\`createdBy\`, \`createdDate\`, \`currencyId\`, \`isActive\`, \`ledgerAccountT"
      }
    }`).checkUnwrap(responseBody)
  })

  it('createHubAccount() creates a new hub account for an invalid type', async () => {
    const requestCreate = {
      payload: {
        currency: 'EUR',
        type: 'invalid'
      },
      params: {
        name: 'Hub'
      }
    } as RequestCreateHubAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3003",
        "errorDescription": "Add Party information error - Ledger account type was not found."
      }
    }`).checkUnwrap(responseBody)
  })

  it('createHubAccount() errors when name !== Hub', async () => {
    const requestCreate = {
      payload: {
        currency: 'KES',
        type: 'HUB_MULTILATERAL_SETTLEMENT'
      },
      params: {
        name: 'BUBBO'
      }
    } as RequestCreateHubAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.createHubAccount(
      requestCreate, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3003",
        "errorDescription": "Add Party information error - Participant was not found."
      }
    }`).checkUnwrap(responseBody)
  })

  it('getByName() tries to get nonexistent participant', async () => {
    const request = {
      params: {
        name: 'Neimand'
      }
    } as RequestGetByName

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getByName(
      request, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - The requested resource could not be found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getByName() gets a real partipant', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_e')
      .build()
      .create()

    const request = {
      params: {
        name: 'dfsp_e'
      }
    } as RequestGetByName

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getByName(
      request, reply
    ))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "name": "dfsp_e",
      "id": "http://central-ledger/participants/dfsp_e",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 1,
      "links": {
        "self": "http://central-ledger/participants/dfsp_e"
      },
      "accounts": [
        {
          "id": :ignore
          "ledgerAccountType": "POSITION",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore
          "ledgerAccountType": "SETTLEMENT",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)
  })

  it('update() sets isActive = false', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_f')
      .build()
      .create()

    const request = {
      params: {
        name: 'dfsp_f'
      },
      payload: {
        isActive: false
      }
    } as RequestUpdate

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.update(
      request, reply
    ))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "name": "dfsp_f",
      "id": "http://central-ledger/participants/dfsp_f",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 0,
      "links": {
        "self": "http://central-ledger/participants/dfsp_f"
      },
      "accounts": [
        {
          "id": :ignore
          "ledgerAccountType": "POSITION",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore
          "ledgerAccountType": "SETTLEMENT",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)
  })

  it('update() sets isActive = true', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_g')
      .build()
      .create()

    const request = {
      params: {
        name: 'dfsp_g'
      },
      payload: {
        isActive: true
      }
    } as RequestUpdate

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.update(
      request, reply
    ))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "name": "dfsp_g",
      "id": "http://central-ledger/participants/dfsp_g",
      "created": "2026-02-01T00:00:00.000Z",
      "isActive": 1,
      "links": {
        "self": "http://central-ledger/participants/dfsp_g"
      },
      "accounts": [
        {
          "id": :ignore
          "ledgerAccountType": "POSITION",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        },
        {
          "id": :ignore
          "ledgerAccountType": "SETTLEMENT",
          "currency": "AUD",
          "isActive": 1,
          "createdDate": "2026-02-01T00:00:00.000Z",
          "createdBy": "unknown"
        }
      ],
      "isProxy": 0
    }`).checkUnwrap(responseBody)
  })

  it('addEndpoint() adds an endpoint.', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('AUD').name('dfsp_h').build().create()

    const request = {
      params: {
        name: 'dfsp_h'
      },
      payload: {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://dfsp_h.com'
      }
    } as RequestAddEndpoint

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.addEndpoint(
      request, reply
    ))

    assert.equal(responseCode, 201)
    assert.equal(responseBody, undefined)
  })

  it('addEndpoint() adds an endpoint for a nonexistent dfsp', async () => {
    const request = {
      params: {
        name: 'dfsp_nope'
      },
      payload: {
        type: 'FSPIOP_CALLBACK_URL_TRANSFER_POST',
        value: 'http://dfsp_nope.com'
      }
    } as RequestAddEndpoint

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.addEndpoint(
      request, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('addEndpoint() adds an invalid endpoint', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('AUD').name('dfsp_i').build().create()
    const request = {
      params: {
        name: 'dfsp_i'
      },
      payload: {
        type: 'THIS IS AN INVALID TYPE',
        value: 'http://dfsp_i.com'
      }
    } as RequestAddEndpoint

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.addEndpoint(
      request, reply
    ))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Cannot read properties of undefined (reading 'endpointTypeId')",
        "extensionList": {
          "extension": [
            {
              "key": "system",
              "value": "[\\"db\\"]"
            }
          ]
        }
      }
    }`).checkUnwrap(responseBody)
  })

  it('addLimitAndInitialPosition() fails for an unknown dfsp', async () => {
    const request = {
      params: {
        name: 'dfsp_j'
      },
      payload: {
        currency: 'AUD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
          alarmPercentage: 10,
        },
        initialPosition: 100
      }
    } as RequestAddLimitAndInitialPosition

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.addLimitAndInitialPosition(
      request, reply
    ))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('addLimitAndInitialPosition() fails for an already created limit and position', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('AUD').name('dfsp_k').build().create()

    const request = {
      params: {
        name: 'dfsp_k'
      },
      payload: {
        currency: 'AUD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
          alarmPercentage: 99,
        },
        initialPosition: 100
      }
    } as RequestAddLimitAndInitialPosition

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.addLimitAndInitialPosition(
      request, reply
    ))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Participant Limit or Initial Position already set for participant: dfsp_k."
      }
    }`).checkUnwrap(responseBody)
  })

  it('addLimitAndInitialPosition() sets the limit and initial position', async () => {
    // Can't use ApiHelpers as they implicitly set the limit and position.
    // Instead use the api.
    const requestCreate = {
      payload: {
        name: 'dfsp_l',
        currency: 'AUD',
      }
    } as RequestCreate

    await unwrapResponse((reply: any) => handler.create(requestCreate, reply))

    const request = {
      params: {
        name: 'dfsp_l'
      },
      payload: {
        currency: 'AUD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 101,
          alarmPercentage: 10,
        },
        initialPosition: 101
      }
    } as RequestAddLimitAndInitialPosition

    const responseAddLimit = await unwrapResponse((reply: any) => handler.addLimitAndInitialPosition(
      request, reply
    ))

    assert.equal(responseAddLimit.responseCode, 201)
    assert.equal(responseAddLimit.responseBody, undefined)


    const requestGetLimits = {
      params: { name: 'dfsp_l' },
      query: { currency: 'AUD' }
    } as RequestGetLimits
    const responseGetLimit = await unwrapResponse((reply: any) => handler.getLimits(
      requestGetLimits, reply
    ))
    Snapshot.from(`[
      {
        "currency": "AUD",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 101,
          "alarmPercentage": 10
        }
      }
    ]`).checkUnwrap(responseGetLimit.responseBody)
  })

  it('addLimitAndInitialPosition() missing alarmPercentage', async () => {
    // Can't use ApiHelpers as they implicitly set the limit and position.
    // Instead use the api.
    const requestCreate = {
      payload: {
        name: 'dfsp_la',
        currency: 'AUD',
      }
    } as RequestCreate

    await unwrapResponse((reply: any) => handler.create(requestCreate, reply))

    const request = {
      params: {
        name: 'dfsp_la'
      },
      payload: {
        currency: 'AUD',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
        },
        initialPosition: 100
      }
    } as RequestAddLimitAndInitialPosition

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.addLimitAndInitialPosition(
      request, reply
    ))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - limit.alarmPercentage is required."
      }
    }`).checkUnwrap(responseBody)
  })

  it('getLimits() gets the limits for the dfsp', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('AUD').name('dfsp_m').build().create()
    const request = {
      params: {
        name: 'dfsp_m',
      },
      query: {
        currency: 'AUD'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[
      {
        "currency": "AUD",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      }
    ]`).checkUnwrap(responseBody)
  })

  it('getLimits() fails for an unknown dfsp', async () => {
    const request = {
      params: {
        name: 'dfsp_n',
      },
      query: {
        currency: 'AUD'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getLimits() when no dfsp exists but no limit has been created', async () => {
    // Can't use ApiHelpers as they implicitly set the limit and position.
    // Instead use the api.
    const requestCreate = {
      payload: {
        name: 'dfsp_o',
        currency: 'AUD',
      }
    } as RequestCreate

    await unwrapResponse((reply: any) => handler.create(requestCreate, reply))

    const request = {
      params: {
        name: 'dfsp_o',
      },
      query: {
        currency: 'AUD'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[]`).checkUnwrap(responseBody)
  })

  it('getLimits() for all currencies', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_n')
      .build()
      .create()
    const request = {
      params: {
        name: 'dfsp_n',
      },
      query: {}
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[
      {
        "currency": "AUD",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      },
      {
        "currency": "EUR",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      }
    ]`).checkUnwrap(responseBody)
  })

  it('getLimits() with invalid limit type', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_o')
      .build()
      .create()
    const request = {
      params: {
        name: 'dfsp_o',
      },
      query: {
        type: 'INVALID_TYPE'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[]`).checkUnwrap(responseBody)
  })

  it('getLimits() with unregistered currency + invalid limit type for existing dfsp', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_pa')
      .build()
      .create()
    const request = {
      params: {
        name: 'dfsp_pa',
      },
      query: {
        currency: 'USD',
        type: 'INVALID_TYPE'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getLimits() with invalid limit type for existing dfsp', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_p')
      .build()
      .create()
    const request = {
      params: {
        name: 'dfsp_p',
      },
      query: {
        type: 'INVALID_TYPE'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[]`).checkUnwrap(responseBody)
  })

  it('getLimits() with an invalid dfsp and invalid type', async () => {
    const request = {
      params: {
        name: 'dfsp_2z',
      },
      query: {
        currency: 'EUR',
        type: 'NET_DEBIT_CAPwyl0'
      }
    } as RequestGetLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getLimits(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getLimitsForAllParticipants() gets all limits', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_q')
      .build()
      .create()
    const request = {
      query: {}
    } as RequestGetLimitsForAllParticipants

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimitsForAllParticipants(request, reply))

    assert.equal(responseCode, 200)
    // Filter for the dfsp we created, otherwise this test breaks isolation.
    const filtered = responseBody.filter((limit: any) => limit.name === 'dfsp_q')

    Snapshot.from(`[
      {
        "name": "dfsp_q",
        "currency": "AUD",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      },
      {
        "name": "dfsp_q",
        "currency": "EUR",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      }
    ]`).checkUnwrap(filtered)
  })

  it('getLimitsForAllParticipants() gets all limits for an invalid type', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_r')
      .build()
      .create()
    const request = {
      query: {
        type: 'invalid'
      }
    } as RequestGetLimitsForAllParticipants

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimitsForAllParticipants(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[]`).checkUnwrap(responseBody)
  })

  it('getLimitsForAllParticipants() gets all limits for a currency', async () => {
    await ApiHelpers.buildDfsp()
      .deps(harness)
      .currency('EUR')
      .currency('AUD')
      .name('dfsp_s')
      .build()
      .create()
    const request = {
      query: { currency: 'EUR' }
    } as RequestGetLimitsForAllParticipants

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getLimitsForAllParticipants(request, reply))

    assert.equal(responseCode, 200)
    // Filter for the dfsp we created, otherwise this test breaks isolation.
    const filtered = responseBody.filter((limit: any) => limit.name === 'dfsp_s')

    Snapshot.from(`[
      {
        "name": "dfsp_s",
        "currency": "EUR",
        "limit": {
          "type": "NET_DEBIT_CAP",
          "value": 10000,
          "alarmPercentage": 10
        }
      }
    ]`).checkUnwrap(filtered)
  })

  it('adjustLimits() adjusts the limit for a dfsp', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('EUR').name('dfsp_t').build().create()
    const request = {
      params: { name: 'dfsp_t' },
      payload: {
        currency: 'EUR',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
          alarmPercentage: 1
        }
      }
    } as RequestAdjustLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.adjustLimits(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "currency": "EUR",
      "limit": {
        "type": "NET_DEBIT_CAP",
        "value": 100,
        "alarmPercentage": 1
      }
    }`).checkUnwrap(responseBody)
  })

  it('adjustLimits() for currency that does not exist', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('EUR').name('dfsp_u').build().create()
    const request = {
      params: { name: 'dfsp_u' },
      payload: {
        currency: 'AAA',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
          alarmPercentage: 1
        }
      }
    } as RequestAdjustLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.adjustLimits(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('adjustLimits() for dfsp that does not exist', async () => {
    const request = {
      params: { name: 'dfsp_nope' },
      payload: {
        currency: 'EUR',
        limit: {
          type: 'NET_DEBIT_CAP',
          value: 100,
          alarmPercentage: 1
        }
      }
    } as RequestAdjustLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.adjustLimits(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('adjustLimits() for limit that does not exist', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('EUR').name('dfsp_v').build().create()
    const request = {
      params: { name: 'dfsp_v' },
      payload: {
        currency: 'EUR',
        limit: {
          type: 'NOPE',
          value: 100,
          alarmPercentage: 1
        }
      }
    } as RequestAdjustLimits

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.adjustLimits(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Unknown limit type: NOPE, expected: 'NET_DEBIT_CAP'."
      }
    }`).checkUnwrap(responseBody)
  })

  it('getPositions() gets the position for all currencies', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('EUR')
      .currency('AUD')
      .name('dfsp_ua')
      .build()
      .create()
    const request = {
      params: { name: 'dfsp_ua' },
      query: {}
    } as RequestGetPositions

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getPositions(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[
      {
        "currency": "AUD",
        "value": 0,
        "changedDate": "2026-02-01T00:00:00.000Z"
      },
      {
        "currency": "EUR",
        "value": 0,
        "changedDate": "2026-02-01T00:00:00.000Z"
      }
    ]`).checkUnwrap(responseBody)
  })

  it('getPositions() gets the position for one currency', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('EUR')
      .currency('AUD')
      .name('dfsp_v')
      .build()
      .create()
    const request = {
      params: { name: 'dfsp_v' },
      query: {
        currency: 'EUR'
      }
    } as RequestGetPositions

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => handler.getPositions(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`{
      "currency": "EUR",
      "value": 0,
      "changedDate": "2026-02-01T00:00:00.000Z"
    }`).checkUnwrap(responseBody)
  })

  it('getPositions() for dfsp that does not exist', async () => {
    const request = {
      params: { name: 'dfsp_nope' },
      query: {
        currency: 'EUR'
      }
    } as RequestGetPositions

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getPositions(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getPositions() for existing dfsp for currency that does not exist', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('EUR')
      .name('dfsp_w')
      .build()
      .create()
    const request = {
      params: { name: 'dfsp_w' },
      query: {
        currency: 'AUD'
      }
    } as RequestGetPositions

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getPositions(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getAccounts() gets the accounts for an existing dfsp + currency', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('EUR')
      .currency('AUD')
      .name('dfsp_w')
      .build()
      .create()
    const request = {
      params: { name: 'dfsp_w' },
      query: {
        currency: 'EUR'
      }
    } as RequestGetAccounts

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getAccounts(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[
      {
        "id": :ignore
        "ledgerAccountType": "POSITION",
        "currency": "EUR",
        "isActive": 1,
        "value": 0,
        "reservedValue": 0,
        "changedDate": "2026-02-01T00:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      },
      {
        "id": :ignore
        "ledgerAccountType": "SETTLEMENT",
        "currency": "EUR",
        "isActive": 1,
        "value": -10000,
        "reservedValue": 0,
        "changedDate": "2026-01-31T23:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      }
    ]`).checkUnwrap(responseBody)
  })

  it('getAccounts() gets the accounts for an existing dfsp', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .currency('EUR')
      .name('dfsp_x')
      .build()
      .create()
    const request = {
      params: { name: 'dfsp_x' },
      query: {}
    } as RequestGetAccounts

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getAccounts(request, reply))

    assert.equal(responseCode, 200)
    Snapshot.from(`[
      {
        "id": :ignore
        "ledgerAccountType": "POSITION",
        "currency": "AUD",
        "isActive": 1,
        "value": 0,
        "reservedValue": 0,
        "changedDate": "2026-02-01T00:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      },
      {
        "id": :ignore
        "ledgerAccountType": "SETTLEMENT",
        "currency": "AUD",
        "isActive": 1,
        "value": -10000,
        "reservedValue": 0,
        "changedDate": "2026-01-31T23:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      },
      {
        "id": :ignore
        "ledgerAccountType": "POSITION",
        "currency": "EUR",
        "isActive": 1,
        "value": 0,
        "reservedValue": 0,
        "changedDate": "2026-02-01T00:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      },
      {
        "id": :ignore
        "ledgerAccountType": "SETTLEMENT",
        "currency": "EUR",
        "isActive": 1,
        "value": -10000,
        "reservedValue": 0,
        "changedDate": "2026-01-31T23:00:00.000Z",
        "createdDate": "2026-02-01T00:00:00.000Z"
      }
    ]`).checkUnwrap(responseBody)
  })

  it('getAccounts() for dfsp that does not exist', async () => {
    const request = {
      params: { name: 'dfsp_nope' },
      query: {}
    } as RequestGetAccounts

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.getAccounts(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('getAll() with isProxy: true shows only proxy dfsps', async () => {
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_xa')
      .proxy()
      .build()
      .create()
    await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_xb')
      .build()
      .create()
    const request = {
      params: { },
      query: {isProxy: true}
    } as RequestGetAll

    const responseA = await unwrapResponseWithError((reply: any) => handler.getAll(request, reply))
    // To make sure this test is isolated, we need to filter by dfsp.
    let filtered = responseA.responseBody
      .filter((acc: any) => acc.name === 'dfsp_xa' || acc.name === 'dfsp_xb')

    assert.equal(responseA.responseCode, 200)
    Snapshot.from(`[
      {
        "name": "dfsp_xa",
        "id": "http://central-ledger/participants/dfsp_xa",
        "created": "2026-02-01T00:00:00.000Z",
        "isActive": 1,
        "links": {
          "self": "http://central-ledger/participants/dfsp_xa"
        },
        "accounts": [
          {
            "id": :ignore,
            "ledgerAccountType": "POSITION",
            "currency": "AUD",
            "isActive": 1,
            "createdDate": "2026-02-01T00:00:00.000Z",
            "createdBy": "unknown"
          },
          {
            "id": :ignore,
            "ledgerAccountType": "SETTLEMENT",
            "currency": "AUD",
            "isActive": 1,
            "createdDate": "2026-02-01T00:00:00.000Z",
            "createdBy": "unknown"
          }
        ],
        "isProxy": 1
      }
    ]`).checkUnwrap(filtered)
  })

  it('updateAccount() for dfsp that does not exist', async () => {
    const request = {
      params: { name: 'dfsp_nope', id: 1 },
      payload: {
        isActive: false
      }
    } as RequestUpdateAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.updateAccount(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('updateAccount() called with dfsp, no account', async () => {
    await ApiHelpers.buildDfsp().deps(harness).currency('AUD').name('dfsp_y').build().create()
    const request = {
      params: { name: 'dfsp_y' },
      payload: {
        isActive: false
      }
    } as RequestUpdateAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.updateAccount(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Account not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('updateAccount() called with dfsp and account', async () => {
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_y')
      .build()
      .create()
    let accounts = await dfsp.getAccounts()
    assert(accounts.length > 0, 'Expected at least one account.')

    const request = {
      params: {
        name: 'dfsp_y',
        id: accounts[0].id,
      },
      payload: {
        isActive: false
      }
    } as RequestUpdateAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.updateAccount(request, reply))

    assert.equal(responseCode, 200)
    assert.equal(responseBody, undefined)

    // Look up the accounts again.
    accounts = await dfsp.getAccounts()
    assert.equal(accounts[0].isActive, false)
  })

  it('updateAccount() activates an active account', async () => {
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_z')
      .build()
      .create()
    let accounts = await dfsp.getAccounts()
    assert(accounts.length > 0, 'Expected at least one account.')

    const request = {
      params: {
        name: 'dfsp_z',
        id: accounts[0].id,
      },
      payload: {
        isActive: true
      }
    } as RequestUpdateAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.updateAccount(request, reply))

    assert.equal(responseCode, 200)
    assert.equal(responseBody, undefined)

    // Look up the accounts again.
    accounts = await dfsp.getAccounts()
    assert.equal(accounts[0].isActive, true)
  })

  it('updateAccount() activates an active account', async () => {
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_z')
      .build()
      .create()
    let accounts = await dfsp.getAccounts()
    assert(accounts.length > 0, 'Expected at least one account.')

    const request = {
      params: {
        name: 'dfsp_z',
        id: accounts[0].id,
      },
      payload: {
        isActive: true
      }
    } as RequestUpdateAccount

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.updateAccount(request, reply))

    assert.equal(responseCode, 200)
    assert.equal(responseBody, undefined)

    // Look up the accounts again.
    accounts = await dfsp.getAccounts()
    assert.equal(accounts[0].isActive, true)
  })

  it.todo('updateAccount() does not allow updating settlement account')
  it.todo('updateAccount() does not allow updating hub accounts')

  it('recordFunds recordFundsOutPrepareReserve for dfsp that does not exist', async () => {
    const transferId = '2100000001'
    const request = {
      params: { name: 'dfsp_nope', id: 1 },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'USD',
          amount: '50000.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve fails against position account', async () => {
    const transferId = '2100000003'
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ab')
      .build()
      .create()
    const account = await dfsp.getPositionAccount('AUD')
    const request = {
      params: { name: 'dfsp_ab', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '50000.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Account is not SETTLEMENT type"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve against settlement account', async () => {
    const transferId = '2100000002'
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_aa')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const request = {
      params: { name: 'dfsp_aa', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '100.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9900.0000')
  })

  it('recordFunds recordFundsOutPrepareReserve twice with the same id + payload', async () => {
    const transferId = '2100000004'
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ab')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const request = {
      params: { name: 'dfsp_ab', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '50000.00'
        }
      }
    } as RequestRecordFunds

    // First.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))
    // Second.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - recordFundsInOut transfer already created."
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve twice with the same id + modified payload', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ab')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const requestA = {
      params: { name: 'dfsp_ab', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '50000.00'
        }
      }
    } as RequestRecordFunds
    const requestB = {
      params: { name: 'dfsp_ab', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '50.00'
        }
      }
    } as RequestRecordFunds

    // First.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestA, reply))
    // Second.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestB, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - recordFundsInOut transfer modified created."
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve + recordFundsOutCommit ', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ab')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name: 'dfsp_ab', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // First.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestCommit = {
      params: { name: 'dfsp_ab', id: account.id, transferId },
      payload: {
        action: "recordFundsOutCommit",
        reason: "withdrawal",
      }
    } as RequestRecordFunds
    // Second.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')
  })

  it('recordFunds recordFundsOutPrepareReserve with insufficent funds', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ac')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name: 'dfsp_ac', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '100000.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Balance didn't change, transfer was rejected.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutPrepareReserve with negative number', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ad')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name: 'dfsp_ad', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '-100.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Balance didn't change, transfer was rejected.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutPrepareReserve with currency mismatch', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ae')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name: 'dfsp_ae', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'USD',
          amount: '100.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - The account does not match participant or currency specified"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve for inactive dfsp', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_ae')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    await dfsp.disable()

    const requestPrepare = {
      params: { name: 'dfsp_ae', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '100.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Participant is currently set inactive"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds with invalid action string', async () => {
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name('dfsp_af')
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    await dfsp.disable()

    const requestPrepare = {
      params: { name: 'dfsp_af', id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "invalid",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '100.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - recordFundsInOutV2 unknown payload.action: invalid"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsOutPrepareReserve + recordFundsOutAbort', async () => {
    const name = 'dfsp_ag'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // Prepare.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestAbort = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutAbort",
        reason: "test",
      }
    } as RequestRecordFunds

    // Abort.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestAbort, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutAbort for transfer that was already committed', async () => {
    const name = 'dfsp_ah'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // Prepare.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestCommit = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutCommit",
        reason: "test",
      }
    } as RequestRecordFunds

    // Commit.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    const requestAbort = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutAbort",
        reason: "test",
      }
    } as RequestRecordFunds

    // Abort.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestAbort, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')
  })

  it('recordFunds recordFundsOutAbort for transfer that was already aborted', async () => {
    const name = 'dfsp_ai'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // Prepare.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestAbort = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutAbort",
        reason: "test",
      }
    } as RequestRecordFunds

    // Abort once.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestAbort, reply))
    // Abort twice.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestAbort, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutCommit for transfer that does not exist', async () => {
    const name = 'dfsp_aj'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestCommit = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutCommit",
        reason: "test",
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutCommit for transfer that was already aborted', async () => {
    const name = 'dfsp_ak'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // Prepare.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestAbort = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutAbort",
        reason: "test",
      }
    } as RequestRecordFunds

    // Commit.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestAbort, reply))

    const requestCommit = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutCommit",
        reason: "test",
      }
    } as RequestRecordFunds

    // Abort.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })

  it('recordFunds recordFundsOutCommit for transfer that was already committed', async () => {
    const name = 'dfsp_aj'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')

    const requestPrepare = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsOutPrepareReserve",
        reason: "withdrawal",
        amount: {
          currency: 'AUD',
          amount: '500.00'
        }
      }
    } as RequestRecordFunds

    // Prepare.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestPrepare, reply))
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')

    const requestCommit = {
      params: { name, id: account.id, transferId },
      payload: {
        action: "recordFundsOutCommit",
        reason: "test",
      }
    } as RequestRecordFunds

    // Commit once.
    await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    // Commit twice.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(requestCommit, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)

    // Check the balance.
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-9500.0000')
  })

  it('recordFunds recordFundsIn success', async () => {
    const name = 'dfsp_ak'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const request = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsIn",
        reason: "Deposit",
        amount: {
          currency: 'AUD',
          amount: '909.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 202)
    assert.equal(responseBody, undefined)
    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10909.0000')
  })

  it('recordFunds recordFundsIn twice with same id', async () => {
    const name = 'dfsp_al'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const request = {
      params: { name, id: account.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsIn",
        reason: "Deposit",
        amount: {
          currency: 'AUD',
          amount: '909.00'
        }
      }
    } as RequestRecordFunds

    // First
    await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    // Second.
    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - recordFundsInOut transfer already created."
      }
    }`).checkUnwrap(responseBody)

    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10909.0000')
  })

  it('recordFunds recordFundsIn for dfsp that does not exist', async () => {
    const name = 'dfsp_am'
    const transferId = harness.prng.uuidv4()
    const request = {
      params: { name, id: 123456 },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsIn",
        reason: "Deposit",
        amount: {
          currency: 'AUD',
          amount: '909.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 400)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3200",
        "errorDescription": "Generic ID not found - participant not found"
      }
    }`).checkUnwrap(responseBody)
  })

  it('recordFunds recordFundsIn against position account fails', async () => {
    const name = 'dfsp_an'
    const transferId = harness.prng.uuidv4()
    const dfsp = await ApiHelpers
      .buildDfsp()
      .deps(harness)
      .currency('AUD')
      .name(name)
      .build()
      .create()
    let account = await dfsp.getSettlementAccount('AUD')
    const accountPosition = await dfsp.getPositionAccount('AUD')
    assert.equal(account.value, '-10000.0000')
    const request = {
      params: { name, id: accountPosition.id },
      payload: {
        transferId,
        externalReference: "67890",
        action: "recordFundsIn",
        reason: "Deposit",
        amount: {
          currency: 'AUD',
          amount: '909.00'
        }
      }
    } as RequestRecordFunds

    const {
      responseBody,
      responseCode
    } = await unwrapResponseWithError((reply: any) => handler.recordFunds(request, reply))

    assert.equal(responseCode, 500)
    Snapshot.from(`{
      "errorInformation": {
        "errorCode": "2001",
        "errorDescription": "Internal server error - Account is not SETTLEMENT type"
      }
    }`).checkUnwrap(responseBody)

    account = await dfsp.getSettlementAccount('AUD')
    assert.equal(account.value, '-10000.0000')
  })
})
