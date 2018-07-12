'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/models/settled-transfers`)
const Db = require(`${src}/db`)

Test('settled-transfers model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.createSandbox()

    Db.settledTransfers = {
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
    createTest.test('insert new record', test => {
      let transfer = { id: '1234', settlementId: 'abc' }
      let created = { transferId: transfer.id, settlementId: transfer.settlementId }

      Db.settledTransfers.insert.returns(P.resolve(created))

      Model.create(transfer)
        .then(c => {
          test.equal(c, created)
          test.ok(Db.settledTransfers.insert.calledWith({ transferId: transfer.id, settlementId: transfer.settlementId }))
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate table', test => {
      Db.settledTransfers.truncate.returns(P.resolve())

      Model.truncate()
        .then(() => {
          test.ok(Db.settledTransfers.truncate.calledOnce)
          test.end()
        })
    })

    truncateTest.end()
  })

  modelTest.end()
})
