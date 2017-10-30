'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Model = require('../../../src/models/settled-transfers')
const Fixtures = require('../../fixtures')
const Db = require('../../../src/db')

const getSettledTransfersCount = () => {
  return Db.settledTransfers.count({}, '*')
}

Test('settled-transfers model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new settledTransfer', test => {
      let payload = { id: Fixtures.generateTransferId(), settlementId: Uuid() }
      createSettledTransfer(payload)
        .then((settledTransfer) => {
          test.ok(settledTransfer)
          test.equal(settledTransfer.transferId, payload.id)
          test.equal(settledTransfer.settlementId, payload.settlementId)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate settledTransfers table', test => {
      Model.truncate()
        .then((executedTransfer) => {
          getSettledTransfersCount()
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

function createSettledTransfer (payload) {
  return Model.create(payload)
}
