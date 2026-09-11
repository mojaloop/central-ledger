'use strict'

const Test = require('tape')
const Inert = require('@hapi/inert')
const Blipp = require('blipp')
const Vision = require('@hapi/vision')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const Config = require('../../../src/lib/config')
const Proxyquire = require('proxyquire')
const APIDocumentation = require('@mojaloop/central-services-shared').Util.Hapi.APIDocumentation
let Plugins = require('../../../src/shared/plugins')

class Server {
  constructor () {
    this.registrations = []
  }

  register (obj) {
    if (obj instanceof Array) {
      this.registrations.push(...obj)
    } else {
      this.registrations.push(obj)
    }
  }

  contains (obj) {
    return this.registrations.indexOf(obj) > -1
  }
}

Test('registerPlugins should', pluginsTest => {
  pluginsTest.test('registers base modules', async function (test) {
    const server = await new Server()
    await Plugins.registerPlugins(server)
    const modules = [Inert, Vision, Blipp, ErrorHandling]
    modules.forEach(x => test.ok(server.contains(x)))
    test.end()
  })

  pluginsTest.test('not register API documentation plugin if disabled in config', async function (test) {
    const ConfigStub = { ...Config }
    ConfigStub.API_DOC_ENDPOINTS_ENABLED = false

    Plugins = Proxyquire('../../../src/shared/plugins', {
      '../lib/config': ConfigStub
    })
    const server = await new Server()
    await Plugins.registerPlugins(server)
    test.ok(!server.contains(APIDocumentation))
    test.end()
  })

  pluginsTest.test('register API documentation plugin if enabled in config', async function (test) {
    const ConfigStub = { ...Config }
    ConfigStub.API_DOC_ENDPOINTS_ENABLED = true

    Plugins = Proxyquire('../../../src/shared/plugins', {
      '../lib/config': ConfigStub
    })
    const server = await new Server()
    await Plugins.registerPlugins(server)
    test.ok(server.registrations[0].plugin.plugin.name.includes('apiDocumentation'))
    test.end()
  })

  pluginsTest.end()
})
