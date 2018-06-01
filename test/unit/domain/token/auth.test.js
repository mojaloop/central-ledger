'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const TokenService = require('../../../../src/domain/token')
const ParticipantService = require('../../../../src/domain/participant')
const UnauthorizedError = require('@mojaloop/central-services-auth').UnauthorizedError
const Crypto = require('../../../../src/lib/crypto')
const Config = require('../../../../src/lib/config')

const TokenAuth = require('../../../../src/domain/token/auth')

const createRequest = (apiKey = null) => {
  return {
    headers: {
      'ledger-api-key': apiKey
    }
  }
}

Test('Token Auth', tokenTest => {
  let sandbox
  let originalAdminKey
  let originalTokenExpiration

  tokenTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(ParticipantService, 'getByName')
    sandbox.stub(TokenService, 'byParticipant')
    sandbox.stub(Crypto, 'verifyHash')
    originalAdminKey = Config.ADMIN_KEY
    originalTokenExpiration = Config.TOKEN_EXPIRATION
    test.end()
  })

  tokenTest.afterEach(test => {
    sandbox.restore()
    Config.ADMIN_KEY = originalAdminKey
    Config.TOKEN_EXPIRATION = originalTokenExpiration
    test.end()
  })

  tokenTest.test('all token validate should', validateTest => {
    validateTest.test('be unauthorized if Ledger-Api-Key header not set', async function (test) {
      const request = createRequest()
      try {
        await TokenAuth.validate(request, 'token', {})
      } catch (err) {
        test.ok(err)
        test.ok(err instanceof UnauthorizedError)
        test.equal(err.message, '"Ledger-Api-Key" header is required')
        test.end()
      }
    })

    validateTest.test('be unauthorized if Ledger-Api-Key not found', async function (test) {
      const name = 'some-name'
      ParticipantService.getByName.withArgs(name).returns(P.resolve(null))
      const request = createRequest(name)
      try {
        await TokenAuth.validate(request, 'token', {})
      } catch (err) {
        test.ok(err)
        test.ok(err instanceof UnauthorizedError)
        test.equal(err.message, '"Ledger-Api-Key" header is not valid')
        test.end()
      }
    })

    validateTest.test('be invalid if token not found by participant', async function (test) {
      const name = 'some-name'
      const participantId = Uuid().toString()
      const participant = {participantId}
      ParticipantService.getByName.withArgs(name).returns(P.resolve(participant))
      TokenService.byParticipant.withArgs(participant).returns(P.resolve([]))
      const request = createRequest(name)

      const reply = {
        response: (response) => {
          test.notOk(response.credentials)
          test.equal(response.isValid, false)
          test.end()
        }
      }
      await TokenAuth.validate(request, 'token', reply)
    })

    validateTest.test('be invalid if token not found by participant and is admin', async function (test) {
      const name = 'admin'
      const participantId = Uuid().toString()
      const participant = {participantId, is_admin: true}
      ParticipantService.getByName.withArgs(name).returns(P.resolve(participant))
      TokenService.byParticipant.withArgs(participant).returns(P.resolve(null))
      const request = createRequest(name)

      const reply = {
        response: (response) => {
          test.notOk(response.credentials)
          test.equal(response.isValid, false)
          test.end()
        }
      }
      await TokenAuth.validate(request, 'token', reply)
    })

    validateTest.test('be invalid if no participant tokens can be verified', async function (test) {
      const name = 'some-name'
      const token = 'token'
      const participantId = Uuid().toString()
      const participant = {participantId}
      ParticipantService.getByName.withArgs(name).returns(P.resolve(participant))
      const tokens = [
        {token: 'bad-token1'},
        {token: 'bad-token2'}
      ]
      Crypto.verifyHash.returns(P.resolve(false))
      TokenService.byParticipant.withArgs(participant).returns(P.resolve(tokens))
      const request = createRequest(name)

      const cb = {
        response: (response) => {
          test.notOk(response.credentials)
          test.equal(response.isValid, false)
          test.end()
        }
      }
      await TokenAuth.validate(request, token, cb)
    })

    validateTest.test('pass with participant if one token can be verified', async function (test) {
      const name = 'some-name'
      const token = 'token'
      const participantId = Uuid().toString()
      const participant = {participantId, is_admin: true}
      ParticipantService.getByName.withArgs(name).returns(P.resolve(participant))
      const tokens = [
        {token: 'bad-token1'},
        {token: 'bad-token2'},
        {token}
      ]
      Crypto.verifyHash.returns(P.resolve(false))
      Crypto.verifyHash.withArgs(token).returns(P.resolve(true))
      TokenService.byParticipant.withArgs(participant).returns(P.resolve(tokens))
      const request = createRequest(name)
      const cb = {
        response: (response) => {
          test.equal(response.isValid, true)
          test.equal(response.credentials, participant)
          test.end()
        }
      }
      await TokenAuth.validate(request, token, cb)
    })

    validateTest.test('be invalid if a token has expired', async function (test) {
      const name = 'some-name'
      const tokenVal = 'token'
      const expiration = 1
      const token = {token: tokenVal, expiration}
      const bearer = 'bearer'
      const participantId = Uuid().toString()
      const participant = {participantId, is_admin: true}
      ParticipantService.getByName.withArgs(name).returns(P.resolve(participant))
      const tokens = [
        token
      ]
      Crypto.verifyHash.returns(P.resolve(false))
      Crypto.verifyHash.withArgs(token.token, bearer).returns(P.resolve(true))
      TokenService.byParticipant.withArgs(participant).returns(P.resolve(tokens))
      const request = createRequest(name)
      Config.TOKEN_EXPIRATION = 1

      const cb = {
        response: (response) => {
          test.equal(response.isValid, false)
          test.equal(response.credentials, participant)
          test.end()
        }
      }
      await TokenAuth.validate(request, bearer, cb)
    })

    validateTest.end()
  })

  tokenTest.test('admin token validate should', validateTest => {
    validateTest.test('return invalid if admin only and key is not admin key', async function (test) {
      const adminKey = 'ADMIN_KEY'
      Config.ADMIN_KEY = adminKey

      const notAdminKey = 'not_admin_key'
      const request = createRequest(notAdminKey)
      try {
        await TokenAuth.validate(request, 'token', {})
      } catch (err) {
        test.ok(err)
        test.ok(err instanceof UnauthorizedError)
        test.equal(err.message, '"Ledger-Api-Key" header is not valid')
        test.end()
      }
    })

    validateTest.test('return admin if admin only and key is admin key', async function (test) {
      const adminKey = 'some-admin-key'
      Config.ADMIN_KEY = adminKey
      const request = createRequest(adminKey)
      const token = 'token'

      TokenService.byParticipant.returns(P.resolve([{token}]))
      Crypto.verifyHash.returns(P.resolve(false))
      Crypto.verifyHash.withArgs(token).returns(P.resolve(true))

      const cb = {
        response: (response) => {
          test.equal(response.isValid, true)
          test.equal(response.credentials.is_admin, true)
          test.notOk(response.credentials.participantId)
          test.end()
        }
      }
      await TokenAuth.validate(request, token, cb)
    })

    validateTest.end()
  })

  tokenTest.end()
})
