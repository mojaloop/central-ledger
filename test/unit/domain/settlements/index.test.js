'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Settlements = require('../../../../src/domain/settlements')
const SettlementEventListener = require('../../../../src/domain/settlements/settlementEventListener')
const Logger = require('@mojaloop/central-services-shared').Logger
const Events = require('../../../../src/lib/events')

const account1 = {accountNumber: '1234', routingNumber: '5678', name: 'Bill'}
const account2 = {accountNumber: '2345', routingNumber: '6789', name: 'Will'}

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

const settledTransfers = [{
  amount: {
    currency_code: 'TZS',
    description: account1.name,
    value: '10.00'
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
    value: '5.00'
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

const mockedCompletedSettlement = {
  transfers: settledTransfers,
  fees: settledFees
}

Test('Settlements Test', settlementTest => {
  let sandbox

  settlementTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(SettlementEventListener)
    sandbox.stub(Logger)
    sandbox.stub(Events)
    t.end()
  })

  settlementTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  settlementTest.test('performSettlement should', performSettlementTest => {
    performSettlementTest.test('return flattened transfers and fees', test => {
      let transfers = [
        generateTransfer(account1, account2, '10.00')
      ]
      let fees = [
        generateFee(account1, account2, '5.00')
      ]
      const settledPosition = Settlements.performSettlement(transfers, fees)
      test.deepEqual(mockedCompletedSettlement, settledPosition)
      test.end()
    })

    performSettlementTest.test('return flattened empty transfers and fees when amounts cancel each other', test => {
      let transfers = [
        generateTransfer(account1, account2, '10.00'),
        generateTransfer(account2, account1, '10.00')
      ]
      let fees = [
        generateFee(account1, account2, '5.00'),
        generateFee(account2, account1, '5.00')
      ]
      const settledPosition = Settlements.performSettlement(transfers, fees)
      test.deepEqual({ fees: [], transfers: [] }, settledPosition)
      test.end()
    })

    performSettlementTest.test('return flattened empty transfers and fees when amounts cancel each other', test => {
      let transfers = [
        generateTransfer(account1, account2, '10.00'),
        generateTransfer(account1, account2, '5.00'),
        generateTransfer(account2, account1, '15.00')
      ]
      let fees = [
        generateFee(account1, account2, '5.00'),
        generateFee(account2, account1, '5.00')
      ]
      const settledPosition = Settlements.performSettlement(transfers, fees)
      test.deepEqual({ fees: [], transfers: [] }, settledPosition)
      test.end()
    })

    performSettlementTest.end()
  })

  settlementTest.end()
})
