'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/api/accounts/handler')
const Account = require('../../../../src/domain/account')
const PositionService = require('../../../../src/domain/position')
const Errors = require('../../../../src/errors')
const Sidecar = require('../../../../src/lib/sidecar')

const createGet = (name, credentials = null) => {
  return {
    params: {name: name || 'name'},
    server: {log: () => { }},
    auth: {
      credentials
    }
  }
}

const createPut = (name, credentials = null) => {
  return {
    params: {name: name || 'name'},
    server: {log: () => { }},
    auth: {
      credentials
    }
  }
}

const createPost = payload => {
  return {
    payload: payload || {},
    server: {log: () => { }}
  }
}

const createAccount = (name, accountId = 1, isDisabled = true) => {
  return {accountId: 1, name: name, createdDate: new Date(), isDisabled: isDisabled}
}

Test('accounts handler', handlerTest => {
  let sandbox
  let originalHostName
  const hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Account, 'create')
    sandbox.stub(Account, 'getByName')
    sandbox.stub(Account, 'getAll')
    sandbox.stub(Account, 'updateUserCredentials')
    sandbox.stub(Account, 'updateAccountSettlement')
    sandbox.stub(PositionService, 'calculateForAccount')
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  const buildPosition = (accountName, payments, receipts, net) => {
    return {
      account: `${hostname}/accounts/${accountName}`,
      payments: payments,
      receipts: receipts,
      net: net
    }
  }

  handlerTest.test('getByName should', getByNameTest => {
    getByNameTest.test('get account by name and set balance to position', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))
      PositionService.calculateForAccount.withArgs(account).returns(P.resolve(buildPosition(account.name, '50', '0', '-50')))

      const request = createGet(name, {name})
      const response = await Handler.getByName(request, {})
      test.equal(response.id, `${hostname}/accounts/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.created, account.createdDate)
      test.equal(response.balance, '-50')
      test.equal(response.is_disabled, true)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    getByNameTest.test('get account by name and set balance to position if admin', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))
      PositionService.calculateForAccount.withArgs(account).returns(P.resolve(buildPosition(account.name, '50', '0', '-50')))
      const response = await Handler.getByName(createGet(name, {name: 'not' + name, is_admin: true}), {})
      test.equal(response.id, `${hostname}/accounts/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.created, account.createdDate)
      test.equal(response.balance, '-50')
      test.equal(response.is_disabled, true)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.end()
    })

    getByNameTest.test('get account by name and set balance to position and default is_disabled to false', async function (test) {
      const name = 'somename'
      const account = {accountId: 1, name: name, createdDate: new Date()}
      Account.getByName.returns(P.resolve(account))
      PositionService.calculateForAccount.withArgs(account).returns(P.resolve(buildPosition(account.name, '50', '0', '-50')))
      const response = await Handler.getByName(createGet(name, {name}), {})
      test.equal(response.id, `${hostname}/accounts/${response.name}`)
      test.equal(response.is_disabled, false)
      test.end()
    })

    getByNameTest.test('reply with limited fields if requesting account is not account', async function (test) {
      const name = 'dfsp1'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))
      const response = await Handler.getByName(createGet(name), {})
      test.equal(response.id, `${hostname}/accounts/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.ledger, hostname)
      test.equal(PositionService.calculateForAccount.callCount, 0)
      test.notOk(response.hasOwnProperty('created'))
      test.notOk(response.hasOwnProperty('balance'))
      test.notOk(response.hasOwnProperty('is_disabled'))
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.end()
    })

    getByNameTest.test('reply with NotFoundError if account null', async function (test) {
      Account.getByName.returns(P.resolve(null))
      try {
        await Handler.getByName(createGet(), {})
      } catch (e) {
        test.ok(e instanceof Errors.NotFoundError)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    getByNameTest.test('reply with error if Account throws error', async function (test) {
      const error = new Error()
      Account.getByName.returns(P.reject(error))
      try {
        await Handler.getByName(createGet(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getByNameTest.test('reply with NotFoundError if position null', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))

      PositionService.calculateForAccount.withArgs(account).returns(P.resolve(null))
      try {
        await Handler.getByName(createGet(name, {name}), {})
      } catch (e) {
        test.ok(e instanceof Errors.NotFoundError)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    getByNameTest.test('reply with error if PositionService throws error', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))

      const error = new Error()
      PositionService.calculateForAccount.withArgs(account).returns(P.reject(error))
      try {
        await Handler.getByName(createGet(name, {name}), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getByNameTest.end()
  })

  handlerTest.test('updateUserCredentials should', updateUserCredentialsTest => {
    updateUserCredentialsTest.test('update a users credentials', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))
      Account.updateUserCredentials.returns(P.resolve(account))

      const request = createPut(name, {name})
      request.payload = {password: '1234'}
      const response = await Handler.updateUserCredentials(request, {})
      test.equal(response.id, `${hostname}/accounts/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updateUserCredentialsTest.test('reply with unauthorized error if user credentials do not match', async function (test) {
      const name = 'somename'
      const account = createAccount(name)
      Account.getByName.returns(P.resolve(account))

      const request = createPut(name, {name: '1234'})
      request.payload = {password: '1234'}
      try {
        await Handler.updateUserCredentials(request)
      } catch (error) {
        test.assert(error instanceof Errors.UnauthorizedError)
        test.equal(error.message, 'Invalid attempt updating the password.')
        test.end()
      }
    })

    updateUserCredentialsTest.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('return created account', async function (assert) {
      const payload = {name: 'dfsp1'}
      const credentials = {key: 'key', secret: 'secret'}
      const account = createAccount(payload.name)
      account.credentials = credentials

      Account.getByName.withArgs(payload.name).returns(P.resolve(null))
      Account.create.withArgs(payload).returns(P.resolve(account))

      const request = createPost(payload)
      const reply = {
        response: (output) => {
          assert.equal(output.id, `${hostname}/accounts/${account.name}`)
          assert.equal(output.name, account.name)
          assert.equal(output.created, account.createdDate)
          assert.equal(output.balance, '0')
          assert.equal(output.is_disabled, account.isDisabled)
          assert.equal(output.ledger, hostname)
          assert.equal(output.credentials.key, credentials.key)
          assert.equal(output.credentials.secret, credentials.secret)
          assert.ok(Sidecar.logRequest.calledWith(request))
          return {
            code: (statusCode) => {
              assert.equal(statusCode, 201)
              assert.end()
            }
          }
        }
      }

      await Handler.create(request, reply)
    })

    createTest.test('return RecordExistsError if name already registered', async function (test) {
      const payload = {name: 'dfsp1'}
      const account = {name: payload.name, createdDate: new Date()}

      Account.getByName.withArgs(payload.name).returns(P.resolve(account))
      try {
        await Handler.create(createPost(payload), {})
      } catch (e) {
        test.ok(e instanceof Errors.RecordExistsError)
        test.equal(e.message, 'An error has occurred: The account has already been registered')
        test.end()
      }
    })

    createTest.test('return error if Account throws error on checking for existing account', async function (test) {
      const payload = {name: 'dfsp1'}
      const error = new Error()

      Account.getByName.returns(P.reject(error))
      try {
        await Handler.create(createPost(payload), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.test('return error if Account throws error on register', async function (test) {
      const payload = {name: 'dfsp1'}
      const error = new Error()

      Account.getByName.returns(P.resolve(null))
      Account.create.returns(P.reject(error))
      try {
        await Handler.create(createPost(payload), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.test('update settlement should', updateSettlementTest => {
    updateSettlementTest.test('return updated settlement', async function (assert) {
      const name = 'dfsp1'
      const payload = {account_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const account = createAccount(name)
      account.credentials = credentials
      const settlement = {
        accountName: account.name,
        accountNumber: payload.account_number,
        routingNumber: payload.routing_number
      }

      Account.getByName.withArgs(name).returns(P.resolve(account))
      Account.updateAccountSettlement.withArgs(account, payload).returns(P.resolve(settlement))

      const request = createPut(name, {name})
      request.payload = payload
      const response = await Handler.updateAccountSettlement(request, {})
      assert.equal(response.account_id, `${hostname}/accounts/${account.name}`)
      assert.equal(response.account_number, payload.account_number)
      assert.equal(response.routing_number, payload.routing_number)
      assert.ok(Sidecar.logRequest.calledWith(request))
      assert.end()
    })

    updateSettlementTest.test('return error if Account throws error on checking for existing account', async function (test) {
      const name = 'dfsp1'
      const payload = {account_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const account = createAccount(name)
      account.credentials = credentials
      const error = new Error()
      Account.getByName.returns(P.reject(error))
      const request = createPut(name, {name})
      request.payload = payload
      try {
        await Handler.updateAccountSettlement(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    updateSettlementTest.test('return error if Account throws error on updateAccountSettlement', async function (test) {
      const name = 'dfsp1'
      const payload = {account_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const account = createAccount(name)
      account.credentials = credentials
      const error = new Error()

      Account.getByName.returns(P.resolve(account))
      Account.updateAccountSettlement.returns(P.reject(error))
      const request = createPut(name, {name})
      request.payload = payload
      try {
        await Handler.updateAccountSettlement(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    updateSettlementTest.test('return error if not authenticated', async function (test) {
      const name = 'dfsp1'
      const payload = {account_number: '123', routing_number: '456'}

      const request = createPut(name, {name: '1234'})
      request.payload = payload
      try {
        await Handler.updateAccountSettlement(request)
      } catch (error) {
        test.assert(error instanceof Errors.UnauthorizedError)
        test.equal(error.message, 'Invalid attempt updating the settlement.')
        test.end()
      }
    })

    updateSettlementTest.end()
  })

  handlerTest.end()
})
