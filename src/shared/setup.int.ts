import { after, before, describe, it } from "node:test"
import assert from "node:assert"
import Harness from '../testing/harness'
import { Snapshot } from "../testing/snapshot"
import { unwrapResponse, createRequest } from "../testing/util"

const harness = Harness.getInstance()
let setup: any

describe('setup', () => {
  before(async () => {
    await harness.up()
    await harness.setupGlobals({
      skipMessageBus: true
    })

    setup = require('./setup')
  })

  after(async () => {
    await harness.teardownGlobals({
      skipMessageBus: true
    })
    await harness.down()
  })

  // TODO: this test hangs, I don't know why!
  it('initialize() runs the admin handler', async () => {
    const Plugin = require('../handlers/api/plugin')
    const MetricPlugin = require('@mojaloop/central-services-metrics').plugin

    const handlers = [{
      type: 'admin',
      enabled: true
    }]
    let result
    try {
      result = await setup.initialize({
        service: 'handler',
        port: 0,
        modules: [Plugin, MetricPlugin],
        runMigrations: false,
        handlers,
        runHandlers: true
      })

      assert(result)
      assert(result.server)
      assert(result.messageBus, 'Expected initialize to return the messageBus.')

      // Check that the health check passes.
      let retries = 5
      let success = false
      let res
      while (retries > 0 && !success) {
        res = await result.server.inject({
          method: 'GET',
          url: '/health',
          payload: {},
          headers: { 'Content-Type': 'application/json' }
        })
        if (res.statusCode === 200) {
          success = true
        }

        retries -= 1
      }
      if (retries === 0) {
        throw new Error(`GET /health out of retries. \
          \nLast payload was: ${JSON.stringify(res.payload)}.`
        )
      }
      assert(res)
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
      }`).checkUnwrap(JSON.parse(res.payload))
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