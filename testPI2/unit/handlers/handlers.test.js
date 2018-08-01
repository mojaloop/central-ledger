'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Handlers = require('../../../src/handlers/register')
const TransferHandler = require('../../../src/handlers/transfers/handler')
const PositionHandler = require('../../../src/handlers/positions/handler')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(PositionHandler, 'registerAllHandlers').returns(P.resolve(true))
    test.end()
  })

  handlersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  handlersTest.test('handlers test should', registerAllTest => {
    registerAllTest.test('register all handlers', async (test) => {
      Sinon.stub(TransferHandler, 'registerAllHandlers').returns(P.resolve(true))
      const result = await Handlers.registerAllHandlers()
      test.equal(result, true)
      test.end()
      TransferHandler.registerAllHandlers.restore()
    })

    registerAllTest.test('throw error when transfer handler throws error', async (test) => {
      try {
        Sinon.stub(TransferHandler, 'registerAllHandlers').throws(new Error())
        await Handlers.registerAllHandlers()
        test.fail('Error not thrown')
        test.end()
        TransferHandler.registerAllHandlers.restore()
      } catch (e) {
        test.pass('Error thrown')
        test.end()
        TransferHandler.registerAllHandlers.restore()
      }
    })

    registerAllTest.end()
  })

  handlersTest.end()
})
