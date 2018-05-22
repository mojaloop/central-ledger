'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')


Test('Commands-Index', commandIndextTest => {
  let sandbox

  commandIndextTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    //sandbox.stub(Logger, 'error')
    t.end()
  })

  commandIndextTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  commandIndextTest.test('commands index saveTransferPrepared should', preparedTest => {

    preparedTest.test('return object of results', async (test) => {

      test.end()
    })

    preparedTest.end()
  })

  commandIndextTest.end()
})
