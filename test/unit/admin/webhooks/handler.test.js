'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const P = require('bluebird')
const TransferService = require('../../../../src/domain/transfer')
const FeeService = require('../../../../src/domain/fee')
const TokenService = require('../../../../src/domain/token')
const Handler = require('../../../../src/admin/webhooks/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const SettlementService = require('../../../../src/domain/settlements')

function createRequest (id, payload) {
  let requestId = id || Uuid()
  let requestPayload = payload || {}
  return {
    payload: requestPayload,
    params: {id: requestId},
    server: {
      log: function () { }
    }
  }
}

function generateTransfer (source, destination, amount) {
  return {
    sourceAccountNumber: source.accountNumber,
    sourceRoutingNumber: source.routingNumber,
    destinationAccountNumber: destination.accountNumber,
    destinationRoutingNumber: destination.routingNumber,
    creditAmount: amount,
    debitAccountName: source.name,
    creditAccountName: destination.name
  }
}

function generateFee (source, destination, amount) {
  return {
    sourceAccountNumber: source.accountNumber,
    sourceRoutingNumber: source.routingNumber,
    destinationAccountNumber: destination.accountNumber,
    destinationRoutingNumber: destination.routingNumber,
    payerAmount: amount,
    payerAccountName: source.name,
    payeeAccountName: destination.name
  }
}

Test('Handler Test', handlerTest => {
  let sandbox

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(TransferService, 'rejectExpired')
    sandbox.stub(TransferService, 'settle')
    sandbox.stub(FeeService, 'settleFeesForTransfers')
    sandbox.stub(TokenService, 'removeExpired')
    sandbox.stub(Sidecar, 'logRequest')
    sandbox.stub(SettlementService)
    t.end()
  })

  handlerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  handlerTest.test('rejectExpired should', rejectExpiredTest => {
    rejectExpiredTest.test('return rejected transfer ids', async function (test) {
      let transferIds = [Uuid(), Uuid(), Uuid()]
      TransferService.rejectExpired.returns(P.resolve(transferIds))
      const response = await Handler.rejectExpired({}, {})
      test.equal(response, transferIds)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    rejectExpiredTest.test('return error if rejectExpired fails', async function (test) {
      let error = new Error()
      TransferService.rejectExpired.returns(P.reject(error))
      try {
        await Handler.rejectExpired(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    rejectExpiredTest.end()
  })

  handlerTest.test('settle should', settleTest => {
    settleTest.test('return settled transfer and fee ids', async function (test) {
      const account1 = {accountNumber: '1234', routingNumber: '5678', name: 'Bill'}
      const account2 = {accountNumber: '2345', routingNumber: '6789', name: 'Will'}
      const account3 = {accountNumber: '3456', routingNumber: '7890', name: 'Rob'}
      let transfers = [
        generateTransfer(account1, account2, '10.00'),
        generateTransfer(account1, account2, '10.00'),
        generateTransfer(account1, account2, '5.00'),
        generateTransfer(account2, account1, '10.00'),
        generateTransfer(account1, account3, '10.00'),
        generateTransfer(account3, account1, '10.00')
      ]
      let fees = [
        generateFee(account1, account2, '5.00'),
        generateFee(account1, account2, '5.00'),
        generateFee(account1, account2, '5.00'),
        generateFee(account2, account1, '10.00'),
        generateFee(account1, account3, '10.00'),
        generateFee(account3, account1, '15.00')
      ]
      TransferService.settle.returns(P.resolve(transfers))
      FeeService.settleFeesForTransfers.returns(P.resolve(fees))

      const settledTransfers = [{
        amount: {
          currency_code: 'TZS',
          description: account1.name,
          value: '15.00'
        },
        destination: {
          account_number: account2.accountNumber,
          routing_number: account2.routingNumber
        },
        source: {
          account_number: account1.accountNumber,
          routing_number: account1.routingNumber
        }
      }]

      const settledFees = [{
        amount: {
          currency_code: 'TZS',
          description: account1.name,
          value: '15.00'
        },
        destination: {
          account_number: account2.accountNumber,
          routing_number: account2.routingNumber
        },
        source: {
          account_number: account1.accountNumber,
          routing_number: account1.routingNumber
        }
      }]
      await Handler.settle({}, {})
      test.deepEqual(settledTransfers, settledFees)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    settleTest.test('return error if settlement failed', async function (test) {
      let error = new Error()
      TransferService.settle.returns(P.reject(error))
      try {
        await Handler.settle(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    settleTest.end()
  })

  handlerTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('return expired tokens', async function (test) {
      let tokenIds = [Uuid(), Uuid(), Uuid()]
      TokenService.removeExpired.returns(P.resolve(tokenIds))
      const response = await Handler.rejectExpiredTokens({}, {})
      test.equal(response, tokenIds)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    removeExpiredTest.test('return error if removeExpired fails', async function (test) {
      let error = new Error()
      TokenService.removeExpired.returns(P.reject(error))
      try {
        await Handler.rejectExpiredTokens(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    removeExpiredTest.end()
  })

  handlerTest.end()
})
