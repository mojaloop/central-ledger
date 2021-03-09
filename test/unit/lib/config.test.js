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

  configTest.end()
})
