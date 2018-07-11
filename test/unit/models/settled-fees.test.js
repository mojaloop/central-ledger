'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/models/settled-fee`)
const Db = require(`${src}/db`)

Test('settled-fee model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.createSandbox()

    Db.settledFee = {
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

      Db.settledFee.insert.returns(P.resolve(created))

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
      Db.settledFee.truncate.returns(P.resolve())

      Model.truncate()
        .then(() => {
          test.ok(Db.settledFee.truncate.calledOnce)
          test.end()
        })
    })

    truncateTest.end()
  })

  modelTest.end()
})
