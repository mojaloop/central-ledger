'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const Errors = require('../../../../src/errors')
const UrlParser = require('../../../../src/lib/urlparser')
const Handler = require('../../../../src/admin/participants/handler')
const Participant = require('../../../../src/domain/participant')
const Sidecar = require('../../../../src/lib/sidecar')

Test('participant handler', handlerTest => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Participant)
    sandbox.stub(Sidecar, 'logRequest')
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('getAll should', getAllTest => {
    getAllTest.test('get all participant and format list', async function (test) {
      const participant1 = {
        name: 'participant1',
        createdDate: new Date(),
        isDisabled: false
      }
      const participant2 = {
        name: 'participant2',
        createdDate: new Date(),
        isDisabled: false
      }
      const participant = [participant1, participant2]

      Participant.getAll.returns(P.resolve(participant))
      const response = await Handler.getAll({}, {})
      test.equal(response.length, 2)
      const item1 = response[0]
      test.equal(item1.name, participant1.name)
      test.equal(item1.id, `${hostname}/participants/${participant1.name}`)
      test.equal(item1.is_disabled, false)
      test.equal(item1.created, participant1.createdDate)
      test.equal(item1._links.self, `${hostname}/participants/${participant1.name}`)
      const item2 = response[1]
      test.equal(item2.name, participant2.name)
      test.equal(item2.id, `${hostname}/participants/${participant2.name}`)
      test.equal(item2.is_disabled, false)
      test.equal(item2.created, participant2.createdDate)
      test.equal(item2._links.self, `${hostname}/participants/${participant2.name}`)
      test.end()
    })

    getAllTest.test('reply with error if Participant services throws', async function (test) {
      const error = new Error()
      Participant.getAll.returns(P.reject(error))

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
    getByNameTest.test('get and format an participant', async function (test) {
      const participant1 = {
        name: 'participant1',
        createdDate: new Date(),
        isDisabled: false
      }

      Participant.getByName.returns(P.resolve(participant1))

      const response = await Handler.getByName({params: {name: participant1.name}}, {})
      test.equal(response.name, participant1.name)
      test.equal(response.id, `${hostname}/participants/${participant1.name}`)
      test.equal(response.is_disabled, false)
      test.equal(response.created, participant1.createdDate)
      test.equal(response._links.self, `${hostname}/participants/${participant1.name}`)
      test.end()
    })

    getByNameTest.test('reply with not found error if Participant does not exist', async function (test) {
      const error = new Errors.NotFoundError('The requested resource could not be found.')
      Participant.getByName.returns(P.resolve(null))

      try {
        await Handler.getByName({params: {name: 'name'}}, {})
      } catch (err) {
        test.deepEqual(err, error)
        test.end()
      }
    })

    getByNameTest.test('reply with error if Participant services throws', async function (test) {
      const error = new Error()
      Participant.getByName.returns(P.reject(error))

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

  handlerTest.test('updateParticipant should', updateParticipantTest => {
    updateParticipantTest.test('update an participant to disabled', async function (test) {
      const participant = {
        name: 'participant1',
        id: `${hostname}/participants/participant1`,
        isDisabled: true,
        createdDate: new Date()
      }

      Participant.update.returns(P.resolve(participant))

      const request = {
        payload: {is_disabled: false},
        params: {name: 'name'}
      }

      const response = await Handler.update(request, {})
      test.equal(response.name, participant.name)
      test.equal(response.id, `${hostname}/participants/${participant.name}`)
      test.equal(response.is_disabled, participant.isDisabled)
      test.equal(response.created, participant.createdDate)
      test.ok(Sidecar.logRequest.calledWith(request))
      test.end()
    })

    updateParticipantTest.test('reply with error if Participant services throws', async function (test) {
      const error = new Error()
      Participant.update.returns(P.reject(error))

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

    updateParticipantTest.end()
  })

  handlerTest.test('create should', createTest => {
    createTest.test('return created participant', async function (test) {
      const payload = {name: 'dfsp1', password: 'dfsp1'}
      const participant = {name: payload.name, createdDate: 'today', isDisabled: true}
      Participant.getByName.returns(P.resolve(null))
      Participant.create.withArgs(payload).returns(P.resolve(participant))
      const participantId = UrlParser.toParticipantUri(participant.name)
      const reply = {
        response: (output) => {
          test.equal(output.id, participantId)
          test.equal(output.is_disabled, participant.isDisabled)
          test.equal(output.created, participant.createdDate)
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
      const participant = {name: payload.name, createdDate: 'today', isDisabled: true}
      Participant.getByName.returns(P.resolve({participant}))

      try {
        await Handler.create({payload}, {})
      } catch (e) {
        test.ok(e instanceof Errors.RecordExistsError)
        test.equal(e.message, 'The participant has already been registered')
        test.end()
      }
    })

    createTest.end()
  })

  handlerTest.end()
})
