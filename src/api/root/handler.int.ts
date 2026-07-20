import { after, before, describe, it } from "node:test"
import assert from "node:assert"
import Harness from '../../testing/harness'
import { Snapshot } from "../../testing/snapshot"
import { unwrapResponse, createRequest, sleepSeconds } from "../../testing/util"

const harness = Harness.getInstance()
let Handler: any

describe('api/root/handler', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals()

    Handler = require('./handler')
  })

  after(async () => {
    await harness.teardownGlobals()
    await harness.down()
  })

  it('Connects and reports the service health.', async () => {
    // Wait for a rebalance.
    await sleepSeconds(5)

    const {
      responseBody,
      responseCode
    } = await unwrapResponse((reply: any) => Handler.getHealth(
      // @ts-ignore
      createRequest({}), reply
    ))

    Snapshot.from(`{
      "status": "OK",
      "uptime": :ignore
      "startTime": :ignore
      "versionNumber": :ignore
      "services": [
        {
          "name": "datastore",
          "status": "OK"
        },
        {
          "name": "broker",
          "status": "OK"
        },
        {
          "name": "proxyCache",
          "status": "OK"
        }
      ]
    }`).checkUnwrap(responseBody)
    assert.equal(responseCode, 200)
  })
})