'use strict'

const src = '../../../../src'
const _ = require('lodash')
const P = require('bluebird')
const Test = require('tape')
const TransferService = require(`${src}/domain/transfer`)
const Account = require(`${src}/domain/account`)
const Fixtures = require('../../../fixtures')
const amount = '50.00'

function createAccounts (accountNames) {
  return P.all(accountNames.map(name => Account.create({ name: name, password: '1234', emailAddress: name + '@test.com' }))).then(accounts => _.reduce(accounts, (m, acct) => _.set(m, acct.name, acct.accountId), {}))
}

Test('transfer service', function (modelTest) {
  modelTest.test('prepare should', function (prepareTest) {
    prepareTest.test('prepare a transfer', function (assert) {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      let transfer = Fixtures.buildTransfer(Fixtures.generateTransferId(), Fixtures.buildDebitOrCredit(debitAccountName, amount, { interledger: 'blah', path: 'blah' }), Fixtures.buildDebitOrCredit(creditAccountName, amount, { interledger: 'blah', path: 'blah' }))

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          TransferService.prepare(transfer)
            .then(result => {
              const prepared = result.transfer
              assert.equal(prepared.id, transfer.id)
              assert.equal(prepared.ledger, transfer.ledger)
              assert.equal(prepared.debits[0].account, transfer.debits[0].account)
              assert.equal(prepared.debits[0].amount, transfer.debits[0].amount)
              assert.equal(prepared.credits[0].account, transfer.credits[0].account)
              assert.equal(prepared.credits[0].amount, transfer.credits[0].amount)
              assert.equal(prepared.execution_condition, transfer.execution_condition)
              assert.equal(prepared.expires_at, transfer.expires_at)
              assert.end()
            })
        })
    })

    prepareTest.end()
  })

  modelTest.test('fulfill should', function (fulfillTest) {
    let fulfillment = 'oAKAAA'

    fulfillTest.test('fulfill a transfer', function (assert) {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      let transferId = Fixtures.generateTransferId()
      let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(debitAccountName, amount), Fixtures.buildDebitOrCredit(creditAccountName, amount))

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          TransferService.prepare(transfer)
            .then(prepared => TransferService.fulfill({ id: transferId, fulfillment: fulfillment }))
            .then(fulfilled => {
              assert.equal(fulfilled.id, transfer.id)
              assert.equal(fulfilled.ledger, transfer.ledger)
              assert.equal(fulfilled.debits[0].account, transfer.debits[0].account)
              assert.equal(fulfilled.debits[0].amount, transfer.debits[0].amount)
              assert.equal(fulfilled.credits[0].account, transfer.credits[0].account)
              assert.equal(fulfilled.credits[0].amount, transfer.credits[0].amount)
              assert.equal(fulfilled.execution_condition, transfer.execution_condition)
              assert.equal(fulfilled.expires_at, transfer.expires_at)
              assert.end()
            })
        })
    })

    fulfillTest.end()
  })

  modelTest.test('reject should', function (rejectTest) {
    let rejectionReason = 'reject this transfer'

    rejectTest.test('reject a transfer', function (assert) {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      let transferId = Fixtures.generateTransferId()
      let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(debitAccountName, amount), Fixtures.buildDebitOrCredit(creditAccountName, amount))

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          TransferService.prepare(transfer)
            .then(prepared => TransferService.reject({ id: transferId, rejection_reason: rejectionReason }))
            .then(result => {
              const rejected = result.transfer
              assert.equal(rejected.id, transfer.id)
              assert.equal(rejected.ledger, transfer.ledger)
              assert.equal(rejected.debits[0].account, transfer.debits[0].account)
              assert.equal(rejected.debits[0].amount, transfer.debits[0].amount)
              assert.equal(rejected.credits[0].account, transfer.credits[0].account)
              assert.equal(rejected.credits[0].amount, transfer.credits[0].amount)
              assert.equal(rejected.execution_condition, transfer.execution_condition)
              assert.equal(rejected.expires_at, transfer.expires_at)
              assert.equal(result.alreadyRejected, false)
              assert.end()
            })
        })
    })

    rejectTest.end()
  })

  modelTest.end()
})
