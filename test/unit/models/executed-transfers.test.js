'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/models/executed-transfers`)
const Db = require(`${src}/db`)

Test('executed-transfers model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.createSandbox()

    Db.executedTransfers = {
      insert: sandbox.stub(),
      truncate: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('insert and return new record', test => {
      let transfer = { id: '1234' }
      let created = { transferId: transfer.id }

      Db.executedTransfers.insert.returns(P.resolve(created))

      Model.create(transfer)
        .then(c => {
          test.equal(c, created)
          test.ok(Db.executedTransfers.insert.calledWith({ transferId: transfer.id }))
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate table', test => {
      Db.executedTransfers.truncate.returns(P.resolve())

      Model.truncate()
        .then(() => {
          test.ok(Db.executedTransfers.truncate.calledOnce)
          test.end()
        })
    })

    truncateTest.end()
  })

  modelTest.end()
})
