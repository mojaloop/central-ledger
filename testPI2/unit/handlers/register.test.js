'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Handlers = require('../../../src/handlers/register')
const TransferHandler = require('../../../src/handlers/transfers/handler')
const PositionHandler = require('../../../src/handlers/positions/handler')
const TimeoutHandler = require('../../../src/handlers/timeouts/handler')
const Proxyquire = require('proxyquire')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(PositionHandler, 'registerAllHandlers').returns(P.resolve(true))
    sandbox.stub(TransferHandler, 'registerAllHandlers').returns(P.resolve(true))
    sandbox.stub(TimeoutHandler, 'registerAllHandlers').returns(P.resolve(true))
    test.end()
  })

  handlersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlersTest.test('handlers test should', registerAllTest => {
    registerAllTest.test('register all handlers', async (test) => {
      const result = await Handlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerAllTest.test('throw error on Handlers.registerAllHandlers', async (test) => {
      let errorMessage = 'require-glob Stub ERROR'
      let HandlersStub = Proxyquire('../../../src/handlers/register', {
        'require-glob': sandbox.stub().throws(new Error(errorMessage))
      })
      try {
        await HandlersStub.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.equal(e.message, errorMessage)
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllTest.test('throw error when transfer handler throws error', async (test) => {
      try {
        sandbox.stub(TransferHandler, 'registerAllHandlers').throws(new Error())
        await Handlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllTest.end()
  })

  handlersTest.end()
})
