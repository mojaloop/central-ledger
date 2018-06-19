'use strict'

const Test = require('tape')
const Model = require('../../../src/models/settlement')

Test('settlement model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new settlement', test => {
      let settlementId = Model.generateId()
      Model.create(settlementId, 'transfer')
        .then((settlement) => {
          test.ok(settlement)
          test.equal(settlement.settlementId, settlementId)
          test.equal(settlement.settlementType, 'transfer')
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.end()
})
