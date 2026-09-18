import { after, afterEach, before, describe, it } from "node:test"
import assert from "node:assert"
import Harness from '../testing/harness'
import { Snapshot } from "../testing/snapshot"

const harness = Harness.getInstance()

describe('setup', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals({
      skipMessageBus: true
    })

  })

  after(async () => {
    await harness.teardownGlobals({
      skipMessageBus: true
    })
    await harness.down()
  })

  it('initialize() runs the admin and settlement APIs', async () => {
    const MetricPlugin = require('@mojaloop/central-services-metrics').plugin
    const setup = require('./setup')

    const handlers = [{
      type: 'admin',
      enabled: true
    }]
    let result
    try {
      result = await setup.initialize({
        service: 'api',
        port: 0,
        modules: [MetricPlugin],
        runMigrations: false,
        handlers,
        runHandlers: true
      })

      assert(result)
      assert(result.server)
      assert(result.messageBus, 'Expected initialize to return the messageBus.')

      await checkEndpoint(result.server, '/health', `200`, Snapshot.from(`{
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
      }`))
      await checkEndpoint(result.server, '/v2/settlementWindows?state=OPEN', `200`, Snapshot.from(`[
        {
          "settlementWindowId": :ignore
          "state": "OPEN",
          "reason": "initial window",
          "createdDate": :ignore
          "changedDate": :ignore
          "content": []
        }
      ]`))
    } finally {
      if (result && result.messageBus) {
        await result.messageBus.deinit()
      }
      if (result && result.server) {
        await result.server.stop()
      }
    }
  })

  // TODO: reenable me once we no longer have global state for kafka producers and consumers.
  // Because kafka has global state, we can't do messageBus.deinit() and reinit().
  it.skip('initialize() service: `handler` runs just the health check', async () => {
    const setup = require('./setup')
    const Plugin = await import('../handlers/api/plugin')
    const handlers = [{
      type: 'admin',
      enabled: true
    }]
    let result
    try {
      result = await setup.initialize({
        service: 'handler',
        port: 0,
        modules: [Plugin],
        runMigrations: false,
        handlers,
        runHandlers: true
      })

      assert(result)
      assert(result.server)
      assert(result.messageBus, 'Expected initialize to return the messageBus.')

      await checkEndpoint(result.server, '/health', `200`, Snapshot.from(`{
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
      }`))
      // Should not exist!
      await checkEndpoint(result.server, '/v2/settlementWindows', `404`, Snapshot.from(`{
      "errorInformation": {
        "errorCode": "3002",
        "errorDescription": "Unknown URI - Not Found"
      }
    }`))
    } finally {
      if (result && result.messageBus) {
        await result.messageBus.deinit()
      }
      if (result && result.server) {
        await result.server.stop()
      }
    }
  })
})


const checkEndpoint = async (server: any, url: string, expectedStatus: string, expected: Snapshot) => {
  let retries = 20
  let success = false
  let res
  while (retries > 0 && !success) {
    res = await server.inject({
      method: 'GET',
      url,
      payload: {},
      headers: { 'Content-Type': 'application/json' }
    })
    if (res.statusCode !== expectedStatus) {
      success = true
    }

    retries -= 1
  }
  if (retries === 0) {
    throw new Error(`GET ${url} out of retries. \
          \nLast status was: ${res.statusCode}.
          \nLast payload was: ${JSON.stringify(res.payload)}.`
    )
  }
  assert(res)
  expected.checkUnwrap(JSON.parse(res.payload))
}