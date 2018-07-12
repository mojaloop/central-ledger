'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const ParticipantService = require('../../../../src/domain/participant')
const ParticipantAuth = require('../../../../src/api/auth/participant')
const Logger = require('@mojaloop/central-services-shared').Logger

Test('participant auth module', authTest => {
  let sandbox

  authTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantService)
    sandbox.stub(Logger)
    t.end()
  })

  authTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  authTest.test('name should be participant', test => {
    test.equal(ParticipantAuth.name, 'participant')
    test.end()
  })

  authTest.test('scheme should be simple', test => {
    test.equal(ParticipantAuth.scheme, 'simple')
    test.end()
  })

  authTest.test('validate should', validateTest => {
    validateTest.test('return false if password missing', async function (test) {
      const response = await ParticipantAuth.validate({}, 'username', '', {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return false if password cannot be verified', async function (test) {
      const name = 'name'
      const password = 'password'
      ParticipantService.verify.withArgs(name, password).returns(P.reject({}).catch(() => { console.log('error occurred') }))
      const response = await ParticipantAuth.validate({}, name, password, {})
      test.notOk(response.credentials)
      test.equal(response.isValid, false)
      test.end()
    })

    validateTest.test('return true if party is configured admin', async function (test) {
      const adminName = 'admin'
      const adminSecret = 'admin'
      Config.ADMIN_KEY = adminName
      Config.ADMIN_SECRET = adminSecret
      const response = await ParticipantAuth.validate({}, adminName, adminSecret, {})
      test.equal(response.isValid, true)
      test.equal(response.credentials.is_admin, true)
      test.equal(response.credentials.name, adminName)
      test.equal(await ParticipantService.verify.callCount, 0)
      test.end()
    })

    validateTest.test('return true and participant if password verified', async function (test) {
      const name = 'name'
      const password = 'password'
      const participant = { name, password }
      ParticipantService.verify.withArgs(name, password).returns(P.resolve(participant))
      const response = await ParticipantAuth.validate({}, name, password, {})
      test.equal(response.isValid, true)
      test.equal(response.credentials, participant)
      test.end()
    })

    validateTest.end()
  })

  authTest.end()
})
