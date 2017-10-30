'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const FeeService = require('../../../../src/domain/fee')
const FeesProjection = require('../../../../src/domain/fee/projection')

const hostname = 'http://some-host'
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('Fees-Projection', feesProjectionTest => {
  let sandbox

  feesProjectionTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(FeeService, 'generateFeesForTransfer')
    sandbox.stub(Logger, 'error')
    t.end()
  })

  feesProjectionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  feesProjectionTest.test('Initialize should', initTest => {
    initTest.test('call done', t => {
      let done = sandbox.stub()

      FeesProjection.initialize({}, done)
      t.ok(done.calledOnce)
      t.end()
    })

    initTest.end()
  })

  feesProjectionTest.test('handleTransferExecuted should', executedTest => {
    const event = {
      id: 2,
      name: 'TransferExecuted',
      payload: {
        ledger: `${hostname}`,
        debits: [{
          account: `${hostname}/accounts/dfsp1`,
          amount: '50'
        }],
        credits: [{
          account: `${hostname}/accounts/dfsp2`,
          amount: '50'
        }],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        fulfillment: 'oAKAAA'
      },
      aggregate: {
        id: Uuid(),
        name: 'Transfer'
      },
      context: 'Ledger',
      timestamp: 1474471284081
    }

    executedTest.test('generate fees in model', test => {
      FeeService.generateFeesForTransfer.returns(P.resolve({}))
      FeesProjection.handleTransferExecuted(event)
      test.ok(FeeService.generateFeesForTransfer.calledWith(event))
      test.end()
    })

    executedTest.test('log error', t => {
      const error = new Error()
      FeeService.generateFeesForTransfer.returns(P.reject(error))

      FeesProjection.handleTransferExecuted(event)
      t.ok(Logger.error.calledWith('Error handling TransferExecuted event', error))
      t.end()
    })

    executedTest.end()
  })

  feesProjectionTest.end()
})
