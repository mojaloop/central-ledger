'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require('../../../../src/domain/token/model')
const Db = require('../../../../src/db')
const Time = require('../../../../src/lib/time')

Test('tokens model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Time, 'getCurrentUTCTimeInMilliseconds')

    Db.tokens = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new token', test => {
      const payload = { accountId: 1, token: 'token', expiration: new Date().getTime() }
      const created = { tokenId: 1 }

      Db.tokens.insert.returns(P.resolve(created))

      Model.create(payload)
        .then(c => {
          let insertArg = Db.tokens.insert.firstCall.args[0]
          test.notEqual(insertArg, payload)
          test.equal(insertArg.accountId, payload.accountId)
          test.equal(insertArg.token, payload.token)
          test.equal(insertArg.expiration, payload.expiration)
          test.equal(c, created)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('byAccount should', byAccountTest => {
    byAccountTest.test('return Model byAccount', test => {
      const account = { accountId: 1 }
      const tokens = [ { accountId: account.accountId, token: 'token1' }, { accountId: account.accountId, token: 'token2' } ]

      Db.tokens.find.returns(P.resolve(tokens))

      Model.byAccount(account)
        .then(results => {
          test.equal(results, tokens)
          test.ok(Db.tokens.find.calledWith({ accountId: account.accountId }))
          test.end()
        })
    })

    byAccountTest.end()
  })

  modelTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('remove expired tokens', test => {
      const currentTime = 1
      Time.getCurrentUTCTimeInMilliseconds.returns(currentTime)

      const expiredTokens = [ { accountId: 1, token: 'token', expiration: 1 } ]

      Db.tokens.destroy.returns(P.resolve(expiredTokens))

      Model.removeExpired()
        .then(removed => {
          test.equal(removed, expiredTokens)
          test.ok(Db.tokens.destroy.calledWith({ 'expiration <=': currentTime }))
          test.end()
        })
    })

    removeExpiredTest.end()
  })

  modelTest.end()
})
