'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Model = require('../../../src/models/settled-fee')
const Db = require('../../../src/db')

const getSettledFeeCount = () => {
  return Db.settledFee.count({}, '*')
}

Test('settled-fee model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new settledFee', test => {
      let payload = { feeId: 1, settlementId: Uuid() }
      createSettledFee(payload)
        .then((settledFee) => {
          test.ok(settledFee)
          test.equal(settledFee.feeId, payload.feeId)
          test.equal(settledFee.settlementId, payload.settlementId)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate settledFee table', test => {
      Model.truncate()
        .then((executedFee) => {
          getSettledFeeCount()
            .then((result) => {
              test.equals(result, 0)
              test.end()
            })
        })
    })

    truncateTest.end()
  })

  modelTest.end()
})

function createSettledFee (payload) {
  return Model.create(payload)
}
