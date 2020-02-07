'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')

const Logger = require('@mojaloop/central-services-logger')
const Handler = require('../../../../src/api/settlement/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const Settlement = require('../../../../src/domain/settlement')

Test('SettlementModel', settlementModelHandlerTest => {
  let sandbox
  const ledgerAccountType = {
    ledgerAccountTypeId: 2,
    name: 'SETTLEMENT',
    description: 'An account to which fees will be charged or collected',
    isActive: 1,
    createdDate: '2018-07-17T16:04:24.185Z'
  }

  settlementModelHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Sidecar)
    sandbox.stub(Logger)
    sandbox.stub(Settlement)
    //  sandbox.stub(Cache)
    // Cache.getEnums.returns(Promise.resolve({ POSITION: 1, SETTLEMENT: 2, HUB_RECONCILIATION: 3, HUB_MULTILATERAL_SETTLEMENT: 4, HUB_FEE: 5 }))
    test.end()
  })

  settlementModelHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  settlementModelHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('create should create a new settlement model and return a 201', async function (test) {
      const payload = {
        name: 'IMMEDIATE_GROSS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION'
      }
      Settlement.getLedgerAccountTypeName.returns(Promise.resolve(ledgerAccountType))
      Settlement.getByName.returns(Promise.resolve(false))
      const reply = {
        response: () => {
          return {
            code: statusCode => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create({ payload }, reply)
    })

    handlerTest.test('create should fail if the settlement model exists', async function (test) {
      const payload = {
        name: 'IMMEDIATE_GROSS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION'
      }
      Settlement.getLedgerAccountTypeName.returns(Promise.resolve(ledgerAccountType))
      Settlement.getByName.returns(Promise.resolve(true))
      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'This Settlement Model already exists')
        test.end()
      }
    })

    handlerTest.test('create should fail if account type does not exists', async function (test) {
      const payload = {
        name: 'DEFERRED_NET',
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        settlementCurrency: 'USD',
        requireLiquidityCheck: true,
        type: 'POSITION'
      }
      Settlement.getLedgerAccountTypeName.returns(Promise.resolve(false))

      try {
        await Handler.create({ payload })
        test.fail('Error not thrown')
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'Ledger account type was not found.')
        test.end()
      }
    })

    handlerTest.end()
  })

  settlementModelHandlerTest.end()
})
