'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Errors = require('../../../../src/errors')
const UrlParser = require('../../../../src/lib/urlparser')
const Handler = require('../../../../src/admin/accounts/handler')
const Account = require('../../../../src/domain/account')
const Sidecar = require('../../../../src/lib/sidecar')

Test('accounts handler', handlerTest => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Account)
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('getAll should', getAllTest => {
    getAllTest.test('get all accounts and format list', async function (test) {
      const account1 = {
        name: 'account1',
        createdDate: new Date(),
        isDisabled: false
      }
      const account2 = {
        name: 'account2',
        createdDate: new Date(),
        isDisabled: false
      }
      const accounts = [account1, account2]

      Account.getAll.returns(P.resolve(accounts))
      const response = await Handler.getAll({}, {})
      test.equal(response.length, 2)
      const item1 = response[0]
      test.equal(item1.name, account1.name)
      test.equal(item1.id, `${hostname}/accounts/${account1.name}`)
      test.equal(item1.is_disabled, false)
      test.equal(item1.created, account1.createdDate)
      test.equal(item1._links.self, `${hostname}/accounts/${account1.name}`)
      const item2 = response[1]
      test.equal(item2.name, account2.name)
      test.equal(item2.id, `${hostname}/accounts/${account2.name}`)
      test.equal(item2.is_disabled, false)
      test.equal(item2.created, account2.createdDate)
      test.equal(item2._links.self, `${hostname}/accounts/${account2.name}`)
      test.end()
    })

    getAllTest.test('reply with error if Account services throws', async function (test) {
      const error = new Error()
      Account.getAll.returns(P.reject(error))

      try {
        await Handler.getAll({}, {})
      } catch (err) {
        test.equal(err, error)
        test.end()
      }
    })

    getAllTest.end()
  })

  handlerTest.test('getByName should', getByNameTest => {
    getByNameTest.test('get and format an account', async function (test) {
      const account1 = {
        name: 'account1',
        createdDate: new Date(),
        isDisabled: false
      }

      Account.getByName.returns(P.resolve(account1))

      const response = await Handler.getByName({params: {name: account1.name}}, {})
      test.equal(response.name, account1.name)
      test.equal(response.id, `${hostname}/accounts/${account1.name}`)
      test.equal(response.is_disabled, false)
      test.equal(response.created, account1.createdDate)
      test.equal(response._links.self, `${hostname}/accounts/${account1.name}`)
      test.end()
    })

    getByNameTest.test('reply with not found error if Account does not exist', async function (test) {
      const error = new Errors.NotFoundError('The requested resource could not be found.')
      Account.getByName.returns(P.resolve(null))

      try {
        await Handler.getByName({params: {name: 'name'}}, {})
      } catch (err) {
        test.deepEqual(err, error)
        test.end()
      }
    })

    getByNameTest.test('reply with error if Account services throws', async function (test) {
      const error = new Error()
      Account.getByName.returns(P.reject(error))

      const reply = (e) => {
        test.equal(e, error)
        test.end()
      }
      try {
        await Handler.getByName({params: {name: 'name'}}, reply)
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getByNameTest.end()
  })

  handlerTest.test('updateAccount should', updateAccountTest => {
    updateAccountTest.test('update an account to disabled', async function (test) {
      const account = {
        name: 'account1',
        id: `${hostname}/accounts/account1`,
        isDisabled: true,
        createdDate: new Date()
      }

      Account.update.returns(P.resolve(account))

      const request = {
        payload: {is_disabled: false},
        params: {name: 'name'}
      }

      const response = await Handler.update(request, {})
      test.equal(response.name, account.name)
      test.equal(response.id, `${hostname}/accounts/${account.name}`)
      test.equal(response.is_disabled, account.isDisabled)
      test.equal(response.created, account.createdDate)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updateAccountTest.test('reply with error if Account services throws', async function (test) {
      const error = new Error()
      Account.update.returns(P.reject(error))

      const request = {
        payload: {is_disabled: false},
        params: {name: 'name'}
      }

      try {
        await Handler.update(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    updateAccountTest.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('return created account', async function (test) {
      const payload = {name: 'dfsp1', password: 'dfsp1'}
      const account = {name: payload.name, createdDate: 'today', isDisabled: true}
      Account.getByName.returns(P.resolve(null))
      Account.create.withArgs(payload).returns(P.resolve(account))
      const accountId = UrlParser.toAccountUri(account.name)
      const reply = {
        response: (output) => {
          test.equal(output.id, accountId)
          test.equal(output.is_disabled, account.isDisabled)
          test.equal(output.created, account.createdDate)
          test.ok(Sidecar.logRequest.calledWith({payload}))
          return {
            code: (statusCode) => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.create({payload}, reply)
    })

    createTest.test('return RecordExistsError if name already registered', async function (test) {
      const payload = {name: 'dfsp1', password: 'dfsp1'}
      const account = {name: payload.name, createdDate: 'today', isDisabled: true}
      Account.getByName.returns(P.resolve({account}))

      try {
        await Handler.create({payload}, {})
      } catch (e) {
        test.ok(e instanceof Errors.RecordExistsError)
        test.equal(e.message, 'The account has already been registered')
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.end()
})
