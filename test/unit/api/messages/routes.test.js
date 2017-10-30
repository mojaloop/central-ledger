'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Base = require('../../base')
const Config = require('../../../../src/lib/config')
const Accounts = require('../../../../src/domain/account')
const Sidecar = require('../../../../src/lib/sidecar')

const toAccount = 'http://central-ledger/accounts/to'
const fromAccount = 'http://central-ledger/accounts/from'

const createPayload = ({ ledger = Config.HOSTNAME, from = fromAccount, to = toAccount, data = {} }) => {
  return {
    ledger,
    from,
    to,
    data
  }
}

const buildRequest = (payload = {}) => {
  return Base.buildRequest({ url: '/messages', method: 'POST', payload })
}

Test('POST /messages', postTest => {
  let sandbox

  postTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Accounts, 'exists')
    sandbox.stub(Sidecar, 'logRequest')
    Accounts.exists.returns(P.resolve({}))
    test.end()
  })

  postTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  postTest.test('return error if required fields are missing', test => {
    let req = buildRequest({})

    Base.setup().then(server => {
      server.inject(req, res => {
        Base.assertBadRequestError(test, res, [
          { message: 'ledger is required', params: { key: 'ledger' } },
          { message: 'from is required', params: { key: 'from' } },
          { message: 'to is required', params: { key: 'to' } },
          { message: 'data is required', params: { key: 'data' } }
        ])
        test.end()
      })
    })
  })

  postTest.test('return error if ledger is not url', test => {
    let req = buildRequest(createPayload({ ledger: 'test' }))

    Base.setup().then(server => {
      server.inject(req, res => {
        Base.assertBadRequestError(test, res, [{ message: 'ledger must be a valid uri', params: { key: 'ledger', value: 'test' } }])
        test.end()
      })
    })
  })

  postTest.test('return error if ledger is not valid', test => {
    let req = buildRequest(createPayload({ ledger: 'http://not-valid' }))
    Base.setup().then(server => {
      server.inject(req, res => {
        Base.assertBadRequestError(test, res, [{ message: 'ledger is not valid for this ledger', params: { key: 'ledger', value: 'http://not-valid' } }])
        test.end()
      })
    })
  })

  postTest.end()
})
