'use strict'

const Test = require('tape')
const Sinon = require('sinon')

const Routes = require('../../../src/admin/routes')

Test('admin routes', routesTest => {
  routesTest.test('register should', registerTest => {
    registerTest.test('register route files', test => {
      const server = {
        route: Sinon.spy()
      }
      const next = Sinon.spy()
      Routes.plugin.register(server, {}, next)

      test.ok(server.route.called)
      test.end()
    })
    registerTest.end()
  })

  routesTest.end()
})
