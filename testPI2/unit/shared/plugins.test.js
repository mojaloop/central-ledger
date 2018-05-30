'use strict'

const Test = require('tape')
const Plugins = require('../../../src/shared/plugins')
const Inert = require('inert')
const Blipp = require('blipp')
const Vision = require('vision')
const ErrorHandling = require('@mojaloop/central-services-error-handling')

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
  pluginsTest.end()
})
