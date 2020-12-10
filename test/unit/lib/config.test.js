'use strict'

const Test = require('tape')
const Proxyquire = require('proxyquire')
const Defaults = require('../../../config/default.json')

Test('Config should', configTest => {
  configTest.test('enable API_DOCUMENTATION_ENDPOINTS', async function (test) {
    const DefaultsStub = { ...Defaults }
    DefaultsStub.API_DOCUMENTATION_ENDPOINTS = true

    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.API_DOCUMENTATION_ENDPOINTS === true)
    test.end()
  })

  configTest.test('disable API_DOCUMENTATION_ENDPOINTS', async function (test) {
    console.log(Defaults)
    const DefaultsStub = { ...Defaults }
    DefaultsStub.API_DOCUMENTATION_ENDPOINTS = false

    const Config = Proxyquire('../../../src/lib/config', {
      '../../config/default.json': DefaultsStub
    })

    test.ok(Config.API_DOCUMENTATION_ENDPOINTS === false)
    test.end()
  })

  configTest.end()
})
