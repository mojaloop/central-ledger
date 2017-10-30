'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const AccountService = require('../../../../src/domain/account')
const UrlParser = require('../../../../src/lib/urlparser')
const ValidationError = require('../../../../src/errors').ValidationError
const AccountTransfers = require('../../../../src/api/sockets/account-transfers')

Test('AccountTransfers', transfersTest => {
  let sandbox
  let socketManager

  transfersTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(AccountService, 'exists')
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

      const url = 'not a valid account url'
      UrlParser.accountNameFromTransfersRoute.withArgs(url).returns(P.reject(new Error()))

      AccountTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socket.send.calledWith(JSON.stringify({ id: 'NotFoundError', message: 'The requested account does not exist' })))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('send error and close socket if account is not valid url', test => {
      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      const err = new Error('No matching account found in url')
      const url = 'not a valid account url'
      UrlParser.accountNameFromTransfersRoute.withArgs(url).returns(P.reject(err))

      AccountTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socket.send.calledWith(JSON.stringify({ id: 'NotFoundError', message: err.message })))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('send error and close socket if account does not exist', test => {
      const name = 'dfsp1'
      const accountUri = `/accounts/${name}`
      const url = `${accountUri}/transfers`

      UrlParser.accountNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toAccountUri.withArgs(name).returns(P.resolve(accountUri))

      const err = new ValidationError(`Account ${name} not found`)
      AccountService.exists.withArgs(accountUri).returns(P.reject(err))

      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      UrlParser.accountNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toAccountUri.withArgs(name).returns(P.resolve(accountUri))

      AccountTransfers.initialize(socket, url, socketManager)
        .then(() => {
          const sendArg = socket.send.firstCall.args[0]
          test.equal(sendArg, JSON.stringify({ id: 'NotFoundError', message: err.message }))
          test.ok(socket.close.calledOnce)
          test.end()
        })
    })

    initializeTest.test('add socket and url to socketManager', test => {
      const name = 'dfsp1'
      const accountUri = `/accounts/${name}`
      const url = `${accountUri}/transfers`

      UrlParser.accountNameFromTransfersRoute.withArgs(url).returns(P.resolve(name))
      UrlParser.toAccountUri.withArgs(name).returns(P.resolve(accountUri))

      AccountService.exists.returns(P.resolve({}))

      const socket = {
        send: sandbox.spy(),
        close: sandbox.spy()
      }

      AccountTransfers.initialize(socket, url, socketManager)
        .then(() => {
          test.ok(socketManager.add.calledWith(socket, accountUri))
          test.notOk(socket.close.called)
          test.end()
        })
    })

    initializeTest.end()
  })

  transfersTest.end()
})
