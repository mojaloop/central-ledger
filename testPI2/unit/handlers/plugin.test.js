'use strict'

const Test = require('tape')
const Plugins = require('../../../src/handlers/api/plugin')

class Server {
  constructor () {
    this.registrations = []
    this.route = () => {}
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
    await Plugins.plugin.register(server)
    test.pass('plugin registered')
    test.end()
  })
  pluginsTest.end()
})
