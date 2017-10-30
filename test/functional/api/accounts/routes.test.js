'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('post and get an account', assert => {
  const accountName = Fixtures.generateAccountName()
  const password = '1234'

  Base.createAccount(accountName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(res => {
      let expectedCreated = res.body.created
      assert.notEqual(expectedCreated, undefined)
      assert.equal(res.body.name, accountName)

      Base.getAccount(accountName)
        .expect(200)
        .expect('Content-Type', /json/)
        .then(getRes => {
          assert.equal(accountName, getRes.body.name)
          assert.equal(expectedCreated, getRes.body.created)
          assert.equal('0', getRes.body.balance)
          assert.equal(false, getRes.body.is_disabled)
          assert.equal('http://central-ledger', getRes.body.ledger)
          assert.end()
        })
    })
})

Test('return the net position for the account as the balance', assert => {
  let fulfillment = 'oAKAAA'
  let transferId = Fixtures.generateTransferId()
  let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.account1Name, '50'), Fixtures.buildDebitOrCredit(Base.account2Name, '50'))

  let transfer2Id = Fixtures.generateTransferId()
  let transfer2 = Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(Base.account2Name, '15'), Fixtures.buildDebitOrCredit(Base.account1Name, '15'))

  Base.prepareTransfer(transferId, transfer)
    .then(() => Base.fulfillTransfer(transferId, fulfillment))
    .then(() => Base.prepareTransfer(transfer2Id, transfer2))
    .then(() => Base.fulfillTransfer(transfer2Id, fulfillment))
    .then(() => {
      Base.getAccount(Base.account1Name)
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          assert.equal(Base.account1Name, res.body.name)
          assert.equal('-35', res.body.balance)
          assert.end()
        })
    })
})

Test('ensure an account name can only be registered once', assert => {
  const accountName = Fixtures.generateAccountName()
  const password = '1234'

  Base.createAccount(accountName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(() => {
      Base.createAccount(accountName, password)
        .expect(422)
        .expect('Content-Type', /json/)
        .then(res => {
          assert.equal(res.body.id, 'RecordExistsError')
          assert.equal(res.body.message, 'The account has already been registered')
          assert.end()
        })
    })
})

Test('update an accounts passsword', test => {
  const accountName = Fixtures.generateAccountName()
  const password = '1234'

  Base.createAccount(accountName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(() => {
      Base.putApi(`/accounts/${accountName}`, { password })
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          test.equal(res.body.id, `http://central-ledger/accounts/${accountName}`)
          test.equal(res.body.name, accountName)
          test.equal(res.body.ledger, 'http://central-ledger')
          test.end()
        })
    })
})

Test('update an accounts settlement', test => {
  const accountName = Fixtures.generateAccountName()
  const password = '1234'
  const accountNumber = '1234'
  const routingNumber = '5678'

  Base.createAccount(accountName, password)
    .expect(201)
    .expect('Content-Type', /json/)
    .then(() => {
      Base.putApi(`/accounts/${accountName}/settlement`, { account_number: accountNumber, routing_number: routingNumber })
        .expect(200)
        .expect('Content-Type', /json/)
        .then(res => {
          test.ok(res.body.account_id)
          test.equal(res.body.account_number, accountNumber)
          test.equal(res.body.routing_number, routingNumber)
          test.end()
        })
    })
})
