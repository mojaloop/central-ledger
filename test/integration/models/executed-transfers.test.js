'use strict'

const src = '../../../src'
const Test = require('tape')
const Fixtures = require('../../fixtures')
const Db = require(`${src}/db`)
const Model = require(`${src}/models/executed-transfers`)

const getExecutedTransfersCount = () => {
  return Db.executedTransfers.count({}, '*')
}

Test('executed-transfers model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new executedTransfer', test => {
      let payload = { id: Fixtures.generateTransferId() }
      Model.create(payload)
        .then((executedTransfer) => {
          test.ok(executedTransfer)
          test.equal(executedTransfer.transferId, payload.id)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('truncate should', truncateTest => {
    truncateTest.test('truncate executedTransfers table', test => {
      Model.truncate()
        .then((executedTransfer) => {
          getExecutedTransfersCount()
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
