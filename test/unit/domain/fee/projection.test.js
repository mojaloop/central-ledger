'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Logger = require('@mojaloop/central-services-shared').Logger
const FeeService = require('../../../../src/domain/fee')
const FeeProjection = require('../../../../src/domain/fee/projection')

const hostname = 'http://some-host'
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('Fee-Projection', feeProjectionTest => {
  let sandbox

  feeProjectionTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(FeeService, 'generateFeeForTransfer')
    sandbox.stub(Logger, 'error')
    t.end()
  })

  feeProjectionTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  feeProjectionTest.test('Initialize should', initTest => {
    initTest.test('call done', t => {
      let done = sandbox.stub()

      FeeProjection.initialize({}, done)
      t.ok(done.calledOnce)
      t.end()
    })

    initTest.end()
  })

  feeProjectionTest.test('handleTransferExecuted should', executedTest => {
    const event = {
      id: 2,
      name: 'TransferExecuted',
      payload: {
        ledger: `${hostname}`,
        debits: [{
          participant: `${hostname}/participants/dfsp1`,
          amount: '50'
        }],
        credits: [{
          participant: `${hostname}/participants/dfsp2`,
          amount: '50'
        }],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        fulfilment: 'oAKAAA'
      },
      aggregate: {
        id: Uuid(),
        name: 'Transfer'
      },
      context: 'Ledger',
      timestamp: 1474471284081
    }

    executedTest.test('generate fee in model', test => {
      FeeService.generateFeeForTransfer.returns(P.resolve({}))
      FeeProjection.handleTransferExecuted(event)
      test.ok(FeeService.generateFeeForTransfer.calledWith(event))
      test.end()
    })

    executedTest.test('log error', t => {
      const error = new Error()
      FeeService.generateFeeForTransfer.returns(P.reject(error))

      FeeProjection.handleTransferExecuted(event)
      t.ok(Logger.error.calledWith('Error handling TransferExecuted event', error))
      t.end()
    })

    executedTest.end()
  })

  feeProjectionTest.end()
})
