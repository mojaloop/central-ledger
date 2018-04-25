'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Handler = require('../../../../src/api/participants/handler')
const Participant = require('../../../../src/domain/participant')
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

const createParticipant = (name, participantId = 1, isDisabled = true) => {
  return {participantId: 1, name: name, createdDate: new Date(), isDisabled: isDisabled}
}

Test('participant handler', handlerTest => {
  let sandbox
  let originalHostName
  const hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Participant, 'create')
    sandbox.stub(Participant, 'getByName')
    sandbox.stub(Participant, 'getAll')
    sandbox.stub(Participant, 'updatePartyCredentials')
    sandbox.stub(Participant, 'updateParticipantSettlement')
    sandbox.stub(PositionService, 'calculateForParticipant')
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  const buildPosition = (participantName, payments, receipts, net) => {
    return {
      participant: `${hostname}/participants/${participantName}`,
      payments: payments,
      receipts: receipts,
      net: net
    }
  }

  handlerTest.test('getByName should', getByNameTest => {
    getByNameTest.test('get participant by name and set balance to position', async function (test) {
      const name = 'somename'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))
      PositionService.calculateForParticipant.withArgs(participant).returns(P.resolve(buildPosition(participant.name, '50', '0', '-50')))

      const request = createGet(name, {name})
      const response = await Handler.getByName(request, {})
      test.equal(response.id, `${hostname}/participants/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.created, participant.createdDate)
      test.equal(response.balance, '-50')
      test.equal(response.is_disabled, true)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    getByNameTest.test('get participant by name and set balance to position if admin', async function (test) {
      const name = 'somename'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))
      PositionService.calculateForParticipant.withArgs(participant).returns(P.resolve(buildPosition(participant.name, '50', '0', '-50')))
      const response = await Handler.getByName(createGet(name, {name: 'not' + name, is_admin: true}), {})
      test.equal(response.id, `${hostname}/participants/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.created, participant.createdDate)
      test.equal(response.balance, '-50')
      test.equal(response.is_disabled, true)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.end()
    })

    getByNameTest.test('get participant by name and set balance to position and default is_disabled to false', async function (test) {
      const name = 'somename'
      const participant = {participantId: 1, name: name, createdDate: new Date()}
      Participant.getByName.returns(P.resolve(participant))
      PositionService.calculateForParticipant.withArgs(participant).returns(P.resolve(buildPosition(participant.name, '50', '0', '-50')))
      const response = await Handler.getByName(createGet(name, {name}), {})
      test.equal(response.id, `${hostname}/participants/${response.name}`)
      test.equal(response.is_disabled, false)
      test.end()
    })

    getByNameTest.test('reply with limited fields if requesting participant is not participant', async function (test) {
      const name = 'dfsp1'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))
      const response = await Handler.getByName(createGet(name), {})
      test.equal(response.id, `${hostname}/participants/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.ledger, hostname)
      test.equal(PositionService.calculateForParticipant.callCount, 0)
      test.notOk(response.hasOwnProperty('created'))
      test.notOk(response.hasOwnProperty('balance'))
      test.notOk(response.hasOwnProperty('is_disabled'))
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.end()
    })

    getByNameTest.test('reply with NotFoundError if participant null', async function (test) {
      Participant.getByName.returns(P.resolve(null))
      try {
        await Handler.getByName(createGet(), {})
      } catch (e) {
        test.ok(e instanceof Errors.NotFoundError)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    getByNameTest.test('reply with error if Participant throws error', async function (test) {
      const error = new Error()
      Participant.getByName.returns(P.reject(error))
      try {
        await Handler.getByName(createGet(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getByNameTest.test('reply with NotFoundError if position null', async function (test) {
      const name = 'somename'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))

      PositionService.calculateForParticipant.withArgs(participant).returns(P.resolve(null))
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
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))

      const error = new Error()
      PositionService.calculateForParticipant.withArgs(participant).returns(P.reject(error))
      try {
        await Handler.getByName(createGet(name, {name}), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getByNameTest.end()
  })

  handlerTest.test('updatePartyCredentials should', updatePartyCredentialsTest => {
    updatePartyCredentialsTest.test('update a party credentials', async function (test) {
      const name = 'somename'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))
      Participant.updatePartyCredentials.returns(P.resolve(participant))

      const request = createPut(name, {name})
      request.payload = {password: '1234'}
      const response = await Handler.updatePartyCredentials(request, {})
      test.equal(response.id, `${hostname}/participants/${response.name}`)
      test.equal(response.name, name)
      test.equal(response.ledger, hostname)
      test.notOk(response.hasOwnProperty('key'))
      test.notOk(response.hasOwnProperty('secret'))
      test.notOk(response.hasOwnProperty('credentials'))
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updatePartyCredentialsTest.test('reply with unauthorized error if party credentials do not match', async function (test) {
      const name = 'somename'
      const participant = createParticipant(name)
      Participant.getByName.returns(P.resolve(participant))

      const request = createPut(name, {name: '1234'})
      request.payload = {password: '1234'}
      try {
        await Handler.updatePartyCredentials(request)
      } catch (error) {
        test.assert(error instanceof Errors.UnauthorizedError)
        test.equal(error.message, 'Invalid attempt updating the password.')
        test.end()
      }
    })

    updatePartyCredentialsTest.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('return created participant', async function (assert) {
      const payload = {name: 'dfsp1'}
      const credentials = {key: 'key', secret: 'secret'}
      const participant = createParticipant(payload.name)
      participant.credentials = credentials

      Participant.getByName.withArgs(payload.name).returns(P.resolve(null))
      Participant.create.withArgs(payload).returns(P.resolve(participant))

      const request = createPost(payload)
      const reply = {
        response: (output) => {
          assert.equal(output.id, `${hostname}/participants/${participant.name}`)
          assert.equal(output.name, participant.name)
          assert.equal(output.created, participant.createdDate)
          assert.equal(output.balance, '0')
          assert.equal(output.is_disabled, participant.isDisabled)
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
      const participant = {name: payload.name, createdDate: new Date()}

      Participant.getByName.withArgs(payload.name).returns(P.resolve(participant))
      try {
        await Handler.create(createPost(payload), {})
      } catch (e) {
        test.ok(e instanceof Errors.RecordExistsError)
        test.equal(e.message, 'An error has occurred: The participant has already been registered')
        test.end()
      }
    })

    createTest.test('return error if Participant throws error on checking for existing participant', async function (test) {
      const payload = {name: 'dfsp1'}
      const error = new Error()

      Participant.getByName.returns(P.reject(error))
      try {
        await Handler.create(createPost(payload), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    createTest.test('return error if Participant throws error on register', async function (test) {
      const payload = {name: 'dfsp1'}
      const error = new Error()

      Participant.getByName.returns(P.resolve(null))
      Participant.create.returns(P.reject(error))
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
      const payload = {participant_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const participant = createParticipant(name)
      participant.credentials = credentials
      const settlement = {
        participantName: participant.name,
        participantNumber: payload.participant_number,
        routingNumber: payload.routing_number
      }

      Participant.getByName.withArgs(name).returns(P.resolve(participant))
      Participant.updateParticipantSettlement.withArgs(participant, payload).returns(P.resolve(settlement))

      const request = createPut(name, {name})
      request.payload = payload
      const response = await Handler.updateParticipantSettlement(request, {})
      assert.equal(response.participant_id, `${hostname}/participants/${participant.name}`)
      assert.equal(response.participant_number, payload.participant_number)
      assert.equal(response.routing_number, payload.routing_number)
      assert.ok(Sidecar.logRequest.calledWith(request))
      assert.end()
    })

    updateSettlementTest.test('return error if Participant throws error on checking for existing participant', async function (test) {
      const name = 'dfsp1'
      const payload = {participant_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const participant = createParticipant(name)
      participant.credentials = credentials
      const error = new Error()
      Participant.getByName.returns(P.reject(error))
      const request = createPut(name, {name})
      request.payload = payload
      try {
        await Handler.updateParticipantSettlement(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    updateSettlementTest.test('return error if Participant throws error on updateParticipantSettlement', async function (test) {
      const name = 'dfsp1'
      const payload = {participant_number: '123', routing_number: '456'}
      const credentials = {key: 'key', secret: 'secret'}
      const participant = createParticipant(name)
      participant.credentials = credentials
      const error = new Error()

      Participant.getByName.returns(P.resolve(participant))
      Participant.updateParticipantSettlement.returns(P.reject(error))
      const request = createPut(name, {name})
      request.payload = payload
      try {
        await Handler.updateParticipantSettlement(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    updateSettlementTest.test('return error if not authenticated', async function (test) {
      const name = 'dfsp1'
      const payload = {participant_number: '123', routing_number: '456'}

      const request = createPut(name, {name: '1234'})
      request.payload = payload
      try {
        await Handler.updateParticipantSettlement(request)
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
