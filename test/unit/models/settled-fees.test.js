'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/models/settled-fees`)
const Db = require(`${src}/db`)

Test('settled-fees model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.settledFees = {
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
      const fee = { feeId: '1234', settlementId: 'abc' }
      const created = { feeId: fee.feeId, settlementId: fee.settlementId }

      Db.settledFees.insert.returns(P.resolve(created))

      Model.create(fee)
        .then(c => {
          test.equal(c, created)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate table', test => {
      Db.settledFees.truncate.returns(P.resolve())

      Model.truncate()
        .then(() => {
          test.ok(Db.settledFees.truncate.calledOnce)
          test.end()
        })
    })

    truncateTest.end()
  })

  modelTest.end()
})
