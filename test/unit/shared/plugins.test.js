'use strict'

const Test = require('tape')
const Plugins = require('../../../src/shared/plugins')
const Inert = require('inert')
const Blipp = require('blipp')
const Vision = require('vision')
const ErrorHandling = require('@mojaloop/central-services-error-handling')
const Auth = require('@mojaloop/central-services-auth')

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
  pluginsTest.test('registers base modules', test => {
    const server = new Server()
    Plugins.registerPlugins(server)
    const modules = [Inert, Vision, Blipp, ErrorHandling, Auth]
    modules.forEach(x => test.ok(server.contains(x)))
    test.end()
  })
  pluginsTest.end()
})
