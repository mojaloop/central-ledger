'use strict'

const Test = require('tape')
const Proxyquire = require('proxyquire')
const Defaults = require('../../../config/default.json')

Test('Config should', configTest => {
  configTest.test('enable API_DOC_ENDPOINTS_ENABLED', async function (test) {
    const DefaultsStub = { ...Defaults }
    DefaultsStub.API_DOC_ENDPOINTS_ENABLED = true

    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.API_DOC_ENDPOINTS_ENABLED === true)
    test.end()
  })

  configTest.test('disable API_DOC_ENDPOINTS_ENABLED', async function (test) {
    console.log(Defaults)
    const DefaultsStub = { ...Defaults }
    DefaultsStub.API_DOC_ENDPOINTS_ENABLED = false

    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.API_DOC_ENDPOINTS_ENABLED === false)
    test.end()
  })

  configTest.test('MAX_FULFIL_TIMEOUT_DURATION_SECONDS has default value if config file value is falsy', async function (test) {
    console.log(Defaults)
    const DefaultsStub = { ...Defaults }
    DefaultsStub.MAX_FULFIL_TIMEOUT_DURATION_SECONDS = null
    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.MAX_FULFIL_TIMEOUT_DURATION_SECONDS === 300)
    test.end()
  })

  configTest.test('evaluate MONGODB_DISABLED to a boolean if a string', async function (test) {
    console.log(Defaults)
    const DefaultsStub = { ...Defaults }
    DefaultsStub.MONGODB.DISABLED = 'true'
    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.MONGODB_DISABLED === true)
    test.end()
  })

  configTest.end()
})
