'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Base = require('../../base')
const Config = require('../../../../src/lib/config')
const Participants = require('../../../../src/domain/participant')
const Sidecar = require('../../../../src/lib/sidecar')

const toParticipant = 'http://central-ledger/participants/to'
const fromParticipant = 'http://central-ledger/participants/from'

const createPayload = ({ledger = Config.HOSTNAME, from = fromParticipant, to = toParticipant, data = {}}) => {
  return {
    ledger,
    from,
    to,
    data
  }
}

const buildRequest = (payload = {}) => {
  return Base.buildRequest({url: '/messages', method: 'POST', payload})
}

Test('POST /messages', postTest => {
  let sandbox

  postTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Participants, 'exists')
    sandbox.stub(Sidecar, 'logRequest')
    Participants.exists.returns(P.resolve({}))
    test.end()
  })

  postTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  postTest.test('return error if required fields are missing', async function (test) {
    let req = buildRequest({})
    const server = await Base.setup()
    const res = await server.inject(req)
    Base.assertBadRequestError(test, res, 'child "ledger" fails because [ledger is required]. child "from" fails because [from is required]. child "to" fails because [to is required]. child "data" fails because [data is required]')
    await server.stop()
    test.end()
  })

  postTest.test('return error if ledger is not url', async function (test) {
    let req = buildRequest(createPayload({ledger: 'test'}))
    const server = await Base.setup()
    const res = await server.inject(req)
    Base.assertBadRequestError(test, res, 'child "ledger" fails because [ledger must be a valid uri]')
    await server.stop()
    test.end()
  })

  postTest.test('return error if ledger is not valid', async function (test) {
    let req = buildRequest(createPayload({ledger: 'http://not-valid'}))
    const server = await Base.setup()
    const res = await server.inject(req)
    Base.assertInvalidBodyError(test, res, 'Body does not match schema')
    await server.stop()
    test.end()
  })

  postTest.end()
})
