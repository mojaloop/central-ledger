import { after, before, describe, it } from "node:test"
import assert from "node:assert"
import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import * as ApiHelpers from '../../testing/api-helpers'

import externalParticipant from './externalParticipant'
const db = require('../../lib/db')
const harness = Harness.getInstance()

describe('models/participant/externalParticipant', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('Should throw error on inserting a record without related proxyId in participant table.', async () => {
    try {
      await externalParticipant.create({
        proxyId: 0,
        name: 'name'
      })
    } catch (err: any) {
      assert(err)
      assert(err.extensions)
      assert(err.extensions[0])

      Snapshot.from(`{
        "key": "system",
        "value": "[\\"db\\"]"
      }`).checkStringUnwrap(JSON.stringify(err.extensions[0], null, 2))

      assert(err.apiErrorCode)
      assert(err.apiErrorCode.code)
      assert(err.apiErrorCode.code === '2001')
      return
    }

    throw new Error('Expected test failure.')
  })

  it('Should not throw error on inserting a record, if the name already exists', async () => {
    // First create the hub + a participant.
    const createHubPayload: ApiHelpers.CreateHubPayload = {
      currencies: ['USD'],
      settlementModels: [{
        name: `DEFERRED_MULTILATERAL_NET_USD`,
        settlementGranularity: "NET",
        settlementInterchange: "MULTILATERAL",
        settlementDelay: "DEFERRED",
        currency: 'USD',
        requireLiquidityCheck: true,
        ledgerAccountType: "POSITION",
        settlementAccountType: "SETTLEMENT",
        autoPositionReset: true
      }]
    }
    await ApiHelpers.createHub(harness, createHubPayload)
    await ApiHelpers.createDfsp(harness, {
      name: 'dfsp_f',
      currencies: ['USD'],
      isProxy: false,
      initialPostionsAndLimits: [
        {
          initialPosition: 0,
          value: 100000
        }
      ],
      deposits: [10000]
    })

    const { participantId } = await db.from('participant').findOne({})
    const result = await externalParticipant.create({
      name: `epName-${Date.now()}`,
      proxyId: participantId,
    })

    assert(result)
  })
})