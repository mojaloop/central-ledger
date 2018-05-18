'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const requireGlob = require('require-glob')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(requireGlob())
    test.end()
  })

  handlersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlersTest.test('handlers test should', registerAllTest => {
    registerAllTest.test('register all handlers', test => {

    })
  })

})
