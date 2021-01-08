'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Handlers = require('../../../src/handlers/register')
const TransferHandlers = require('../../../src/handlers/transfers/handler')
const PositionHandlers = require('../../../src/handlers/positions/handler')
const TimeoutHandlers = require('../../../src/handlers/timeouts/handler')
const AdminHandlers = require('../../../src/handlers/admin/handler')
const BulkTransferHandlers = require('../../../src/handlers/bulk/prepare/handler')
const BulkProcessingHandlers = require('../../../src/handlers/bulk/processing/handler')
const BulkFulfilHandlers = require('../../../src/handlers/bulk/fulfil/handler')
const BulkGetHandlers = require('../../../src/handlers/bulk/get/handler')
const Proxyquire = require('proxyquire')

Test('handlers', handlersTest => {
  let sandbox

  handlersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(PositionHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(TransferHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(TimeoutHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(AdminHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(BulkTransferHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(BulkProcessingHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(BulkFulfilHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
    sandbox.stub(BulkGetHandlers, 'registerAllHandlers').returns(Promise.resolve(true))
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
      const errorMessage = 'require-glob Stub ERROR'
      const HandlersStub = Proxyquire('../../../src/handlers/register', {
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
        sandbox.stub(TransferHandlers, 'registerAllHandlers').throws(new Error())
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
