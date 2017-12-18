'use strict'

const Test = require('tape')
const Fixtures = require('../../../fixtures')
const Db = require('../../../../src/db')
const Model = require('../../../../src/domain/account/model')

function createAccount (name, hashedPassword = 'password', emailAddress = name + '@test.com') {
  const payload = { name, hashedPassword, emailAddress }
  return Model.create(payload)
}

function deleteAccounts () {
  return Db.from('accounts').destroy()
}

Test('accounts model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new account', test => {
      const accountName = Fixtures.generateAccountName()
      const hashedPassword = 'some-password'
      const emailAddress = accountName + '@test.com'
      createAccount(accountName, hashedPassword, emailAddress)
        .then((account) => {
          test.equal(account.name, accountName)
          test.ok(account.createdDate)
          test.ok(account.accountId)
          test.ok(account.emailAddress)
          test.equal(account.isDisabled, false)
          test.ok
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('getByName should', getByNameTest => {
    getByNameTest.test('get account by name', test => {
      const accountName = Fixtures.generateAccountName()
      createAccount(accountName)
        .then((account) => {
          Model.getByName(account.name)
            .then((found) => {
              test.notEqual(found, account)
              test.equal(found.name, account.name)
              test.deepEqual(found.createdDate, account.createdDate)
              test.equal(found.emailAddress, account.emailAddress)
              test.equal(found.isDisabled, false)
              test.end()
            })
        })
    })

    getByNameTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('get account by id', test => {
      const accountName = Fixtures.generateAccountName()
      createAccount(accountName)
        .then((account) => {
          Model.getById(account.accountId)
            .then((found) => {
              test.notEqual(found, account)
              test.equal(found.accountId, account.accountId)
              test.deepEqual(found.createdDate, account.createdDate)
              test.equal(found.isDisabled, false)
              test.end()
            })
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return all accounts and order by name ascending', test => {
      const account1Name = 'zzz' + Fixtures.generateAccountName()
      const account2Name = 'aaa' + Fixtures.generateAccountName()

      deleteAccounts()
        .then(() => createAccount(account1Name))
        .then(() => createAccount(account2Name))
        .then(() => Model.getAll())
        .then(accounts => {
          test.equal(accounts.length, 2)
          test.equal(accounts[0].name, account2Name)
          test.equal(accounts[1].name, account1Name)
          test.end()
        })
    })

    getAllTest.end()
  })

  modelTest.test('update should', updateTest => {
    updateTest.test('update account isDisabled field', test => {
      const accountName = Fixtures.generateAccountName()
      const isDisabled = true
      createAccount(accountName)
        .then((account) => {
          Model.update(account, isDisabled)
            .then((updated) => {
              test.notEqual(updated, account)
              test.equal(updated.name, account.name)
              test.deepEqual(updated.createdDate, account.createdDate)
              test.equal(updated.isDisabled, isDisabled)
              test.end()
            })
        })
    })

    updateTest.end()
  })

  modelTest.test('updateUserCredentials should', updateUserCredentialsTest => {
    updateUserCredentialsTest.test('update user credentials for a given account', test => {
      const account = Fixtures.generateAccountName()
      const password = 'password'
      const updatedPassword = 'password2'
      createAccount(account, password)
        .then((createdAccount) => Model.updateUserCredentials(createdAccount, updatedPassword)
          .then((userCredentials) => {
            test.equal(userCredentials.accountId, createdAccount.accountId)
            test.equal(userCredentials.password, updatedPassword)
            test.end()
          }))
    })

    updateUserCredentialsTest.end()
  })

  modelTest.test('retrieveUserCredentials should', retrieveUserCredentialsTest => {
    retrieveUserCredentialsTest.test('return user credentials for a given account', test => {
      const account = Fixtures.generateAccountName()
      const password = 'password'
      createAccount(account, password)
        .then((createdAccount) => Model.retrieveUserCredentials(createdAccount)
          .then((userCredentials) => {
            test.equal(userCredentials.accountId, createdAccount.accountId)
            test.equal(userCredentials.password, password)
            test.end()
          }))
    })

    retrieveUserCredentialsTest.end()
  })

  modelTest.test('updateAccountSettlement should', updateAccountSettlementTest => {
    updateAccountSettlementTest.test('update settlement for a given account', test => {
      const account = Fixtures.generateAccountName()
      const settlement = {
        account_number: '12345',
        routing_number: '67890'
      }
      createAccount(account, '1234')
        .then((createdAccount) => Model.updateAccountSettlement(createdAccount, settlement)
          .then((accountSettlement) => {
            test.equal(accountSettlement.accountName, account)
            test.equal(accountSettlement.accountNumber, settlement.account_number)
            test.equal(accountSettlement.routingNumber, settlement.routing_number)
            test.end()
          }))
    })

    updateAccountSettlementTest.end()
  })

  modelTest.end()
})
