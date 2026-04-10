'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Handlers = require('../../../src/handlers/register')
const ProxyCache = require('#src/lib/proxyCache')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Handlers.transfers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.positions, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.positionsBatch, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.timeouts, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.admin, 'registerAdminHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.bulk, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.deferredSettlement, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(Handlers.grossSettlement, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(ProxyCache, 'getCache').returns({
      connect: sandbox.stub(),
      disconnect: sandbox.stub()
    })
    test.end()
  })

  handlersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlersTest.test('handlers test should', registerAllTest => {
    registerAllTest.test('register all handlers', async (test) => {
      // Complete the stub.
      sandbox.stub(Handlers.rules, 'registerAllHandlers').returns(Promise.resolve(true))

      const result = await Handlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
    })

    registerAllTest.test('handles error when registering a handler', async (test) => {
      // Complete the stub.
      sandbox.stub(Handlers.rules, 'registerAllHandlers').returns(Promise.reject(new Error('Test error')))

      try {
        await Handlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
      } catch (e) {
        test.equal(e.message, 'Test error')
        test.pass('Error thrown')
        test.end()
      }
    })

    registerAllTest.end()
  })

  handlersTest.end()
})
