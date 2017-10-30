'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const TokenService = require('../../../../src/domain/token')
const Model = require('../../../../src/domain/token/model')
const Crypto = require('../../../../src/lib/crypto')
const Time = require('../../../../src/lib/time')
const Config = require('../../../../src/lib/config')

Test('Token Service', serviceTest => {
  let sandbox
  let originalTokenExpiration

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Crypto)
    sandbox.stub(Model)
    sandbox.stub(Time, 'getCurrentUTCTimeInMilliseconds')
    originalTokenExpiration = Config.TOKEN_EXPIRATION
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    Config.TOKEN_EXPIRATION = originalTokenExpiration
    test.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('generate token and save hash to model', test => {
      const accountId = 1234
      const account = { accountId }
      const token = 'token'
      const tokenHash = 'tokenHash'
      const encodedTokenHash = tokenHash
      Crypto.generateToken.returns(P.resolve(token))
      Crypto.hash.withArgs(token).returns(P.resolve(tokenHash))
      Model.create.returns(P.resolve({ accountId, token: encodedTokenHash }))
      TokenService.create(account)
        .then(result => {
          test.equal(result.token, token)
          test.ok(Model.create.calledWith(Sinon.match({ accountId, token: encodedTokenHash })))
          test.end()
        })
    })
    createTest.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('generate expiration if Config.TOKEN_EXPIRATION is set', test => {
      const accountId = 1234
      const account = { accountId }
      const token = 'token'
      const tokenHash = 'tokenHash'
      const encodedTokenHash = tokenHash
      Crypto.generateToken.returns(P.resolve(token))
      Crypto.hash.withArgs(token).returns(P.resolve(tokenHash))
      const currentTime = 1001
      const tokenExpiration = 1000
      const tokenExpires = currentTime + tokenExpiration

      Time.getCurrentUTCTimeInMilliseconds.returns(currentTime)
      Config.TOKEN_EXPIRATION = tokenExpiration

      Model.create.returns(P.resolve({ accountId, token: encodedTokenHash, expiration: tokenExpires }))
      TokenService.create(account)
        .then(result => {
          test.ok(Model.create.calledWith(Sinon.match({ accountId, token: encodedTokenHash, expiration: tokenExpires })))
          test.end()
        })
    })

    createTest.test('create non expiring token if Config.TOKEN_EXPIRATION not set', test => {
      const accountId = 1234
      const account = { accountId }
      const token = 'token'
      const tokenHash = 'tokenHash'
      const encodedTokenHash = tokenHash
      Crypto.generateToken.returns(P.resolve(token))
      Crypto.hash.withArgs(token).returns(P.resolve(tokenHash))
      Config.TOKEN_EXPIRATION = null
      Model.create.returns(P.resolve({}))

      TokenService.create(account)
        .then(result => {
          test.ok(Model.create.calledWith(Sinon.match({ accountId, token: encodedTokenHash, expiration: null })))
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('byAccount should', byAccountTest => {
    byAccountTest.test('return byToken from Model', test => {
      const accountId = 1
      const account = { accountId }
      Model.byAccount.returns(P.resolve([]))
      TokenService.byAccount(account)
        .then(result => {
          test.ok(Model.byAccount.calledWith(Sinon.match({ accountId })))
          test.end()
        })
    })

    byAccountTest.end()
  })

  serviceTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('remove expired tokens', test => {
      Model.removeExpired.returns(P.resolve([]))
      TokenService.removeExpired()
        .then(result => {
          test.equal(Model.removeExpired.callCount, 1)
          test.end()
        })
    })

    removeExpiredTest.end()
  })

  serviceTest.end()
})
