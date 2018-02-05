'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/domain/account/model`)
const Db = require(`${src}/db`)

Test('accounts model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.accounts = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub()
    }
    Db.userCredentials = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      update: sandbox.stub()
    }
    Db.accountsSettlement = {
      insert: sandbox.stub(),
      findOne: sandbox.stub(),
      update: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.accounts.find.returns(P.reject(error))

      Model.getAll()
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getAllTest.test('return all accounts ordered by name', test => {
      const account1Name = 'dfsp1'
      const account2Name = 'dfsp2'
      const accounts = [{ name: account1Name }, { name: account2Name }]

      Db.accounts.find.returns(P.resolve(accounts))

      Model.getAll()
        .then((found) => {
          test.equal(found, accounts)
          test.ok(Db.accounts.find.calledWith({}, { order: 'name asc' }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getAllTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.accounts.findOne.returns(P.reject(error))

      Model.getById(1)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getByIdTest.test('finds account by id', test => {
      const id = 1
      const account = { accountId: id }

      Db.accounts.findOne.returns(P.resolve(account))

      Model.getById(id)
        .then(r => {
          test.equal(r, account)
          test.ok(Db.accounts.findOne.calledWith({ accountId: id }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getByName should', getByNameTest => {
    getByNameTest.test('return exception if db query throws', test => {
      let name = 'dfsp1'
      let error = new Error()

      Db.accounts.findOne.returns(P.reject(error))

      Model.getByName(name)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getByNameTest.test('finds account by name', test => {
      let name = 'dfsp1'
      let account = { name: name }

      Db.accounts.findOne.returns(P.resolve(account))

      Model.getByName(name)
        .then(r => {
          test.equal(r, account)
          test.ok(Db.accounts.findOne.calledWith({ name }))
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    getByNameTest.end()
  })

  modelTest.test('update should', updateTest => {
    updateTest.test('return exception if db query throws', test => {
      let error = new Error()
      const id = 1
      const account = { accountId: id }
      const isDisabled = false

      Db.accounts.update.returns(P.reject(error))

      Model.update(account, isDisabled)
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.ok(Db.accounts.update.withArgs({ accountId: id }, { isDisabled }).calledOnce)
          test.equal(err, error)
          test.end()
        })
    })

    updateTest.test('update an account', test => {
      let name = 'dfsp1'
      const isDisabled = true
      const id = 1

      let account = {
        accountId: id,
        name: name,
        isDisabled: false
      }

      let updatedAccount = {
        accountId: id,
        name: name,
        isDisabled: isDisabled
      }

      Db.accounts.update.returns(P.resolve(updatedAccount))

      Model.update(account, isDisabled)
        .then(r => {
          test.ok(Db.accounts.update.withArgs({ accountId: id }, { isDisabled }).calledOnce)
          test.equal(r, updatedAccount)
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateTest.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new account', test => {
      let name = 'dfsp1'
      let emailAddress = 'dfsp1@test.com'
      let payload = { name: name, hashedPassword: 'hashedPassword', emailAddress: emailAddress }
      let insertedAccount = { accountId: 1, name: name, emailAddress: emailAddress }

      Db.accounts.insert.returns(P.resolve(insertedAccount))
      Db.userCredentials.insert.returns(P.resolve({}))

      Model.create(payload)
        .then(s => {
          test.ok(Db.accounts.insert.withArgs({ name: name, emailAddress: payload.emailAddress }).calledOnce)
          test.ok(Db.userCredentials.insert.withArgs({ accountId: insertedAccount.accountId, password: payload.hashedPassword }).calledOnce)
          test.equal(s, insertedAccount)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('updateUserCredentials should', updateUserCredentialsTest => {
    updateUserCredentialsTest.test('return user credentials for a given account', test => {
      let account = { name: 'dfsp1', accountId: '1234' }
      let password = '1234'
      let userCredentials = { accountId: account.accountId, password }

      Db.userCredentials.update.returns(P.resolve(userCredentials))

      Model.updateUserCredentials(account, password)
        .then(r => {
          test.ok(Db.userCredentials.update.withArgs({ accountId: account.accountId }, { password }).calledOnce)
          test.equal(r, userCredentials)
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateUserCredentialsTest.end()
  })

  modelTest.test('retrieveUserCredentials should', retrieverUserCredsTest => {
    retrieverUserCredsTest.test('return user credentials for a given account', test => {
      let account = { name: 'dfsp1', accountId: '1234' }
      let userCredentials = { accountId: account.accountId, password: 'password' }

      Db.userCredentials.findOne.returns(P.resolve(userCredentials))

      Model.retrieveUserCredentials(account)
        .then(r => {
          test.equal(r.accountId, userCredentials.accountId)
          test.equal(r.password, userCredentials.password)
          test.ok(Db.userCredentials.findOne.calledWith({ accountId: account.accountId }))
          test.end()
        })
    })

    retrieverUserCredsTest.end()
  })

  modelTest.test('updateAccountSettlement should', updateAccountSettlementTest => {
    updateAccountSettlementTest.test('return created settlement for a given account', test => {
      let accountId = '1234'
      let accountNumber = '12345'
      let routingNumber = '67890'
      let name = 'name'

      Db.accountsSettlement.findOne.returns(P.resolve(null))
      Db.accountsSettlement.insert.returns(P.resolve({ accountId, accountNumber, routingNumber }))

      Model.updateAccountSettlement({ accountId, name }, { account_number: accountNumber, routing_number: routingNumber })
        .then(r => {
          test.ok(Db.accountsSettlement.insert.withArgs({ accountId, accountNumber, routingNumber }).calledOnce)
          test.deepEqual(r, { accountName: name, accountNumber, routingNumber })
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateAccountSettlementTest.test('return updated settlement for a given account', test => {
      let accountId = '1234'
      let accountNumber = '12345'
      let routingNumber = '67890'
      let name = 'name'

      Db.accountsSettlement.findOne.returns(P.resolve({ accountId, accountNumber, routingNumber }))
      Db.accountsSettlement.update.returns(P.resolve({ accountId, accountNumber, routingNumber }))

      Model.updateAccountSettlement({ accountId, name }, { account_number: accountNumber, routing_number: routingNumber })
        .then(r => {
          test.ok(Db.accountsSettlement.update.withArgs({ accountId }, { accountNumber, routingNumber }).calledOnce)
          test.deepEqual(r, { accountName: name, accountNumber, routingNumber })
          test.end()
        })
        .catch(err => {
          test.fail(err)
        })
    })

    updateAccountSettlementTest.end()
  })

  modelTest.end()
})
