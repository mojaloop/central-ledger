'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const ParticipantService = require('../../../../src/domain/participant')
const UrlParser = require('../../../../src/lib/urlParser')
const ValidationError = require('../../../../src/errors').ValidationError
const ParticipantTransfers = require('../../../../src/api/sockets/participantTransfers')

Test('ParticipantTransfers', transfersTest => {
  let sandbox
  let socketManager

  transfersTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(ParticipantService, 'exists')
    sandbox.stub(UrlParser)

    socketManager = {
      add: sandbox.spy()
    }
    test.end()
  })

  transfersTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  transfersTest.test('initialize should', initializeTest => {
    initializeTest.test('use default message if no message found on error', test => {
      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      const url = 'not a valid participant url'
      UrlParser.participantNameFromTransfersRoute.withArgs(url).returns(P.reject(new Error()))

      ParticipantTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socket.send.calledWith(JSON.stringify({ id: 'NotFoundError', message: 'The requested participant does not exist' })))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('send error and close socket if participant is not valid url', test => {
      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      const err = new Error('No matching participant found in url')
      const url = 'not a valid participant url'
      UrlParser.participantNameFromTransfersRoute.withArgs(url).returns(P.reject(err))

      ParticipantTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socket.send.calledWith(JSON.stringify({ id: 'NotFoundError', message: err.message })))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('send error and close socket if participant does not exist', test => {
      const name = 'dfsp1'
      const participantUri = `/participants/${name}`
      const url = `${participantUri}/transfers`

      UrlParser.participantNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toParticipantUri.withArgs(name).returns(P.resolve(participantUri))

      const err = new ValidationError(`Participant ${name} not found`)
      ParticipantService.exists.withArgs(participantUri).returns(P.reject(err))

      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      UrlParser.participantNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toParticipantUri.withArgs(name).returns(P.resolve(participantUri))

      ParticipantTransfers.initialize(socket, url, socketManager)
        .then(() => {
          const sendArg = socket.send.firstCall.args[0]
          test.equal(sendArg, JSON.stringify({ id: 'NotFoundError', message: err.message }))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('add socket and url to socketManager', test => {
      const name = 'dfsp1'
      const participantUri = `/participants/${name}`
      const url = `${participantUri}/transfers`

      UrlParser.participantNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toParticipantUri.withArgs(name).returns(P.resolve(participantUri))

      ParticipantService.exists.returns(P.resolve({}))

      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      ParticipantTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socketManager.add.calledWith(socket, participantUri))
          test.notOk(socket.close.called)
          test.end()
        })
    })

    initializeTest.end()
  })

  transfersTest.end()
})
