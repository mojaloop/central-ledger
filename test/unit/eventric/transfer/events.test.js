'use strict'

const Test = require('tapes')(require('tape'))
const Events = require('../../../../src/eventric/transfer/events')

Test('Events Test', eventsTest => {
  eventsTest.test('TranserExcecuted should', executedTest => {
    executedTest.test('Set fulfillment', t => {
      let fulfillment = 'fulfillment'
      let result = Events.TransferExecuted({ fulfillment: fulfillment })
      t.equal(result.fulfillment, fulfillment)
      t.end()
    })
    executedTest.end()
  })

  eventsTest.test('TransferRejected should', rejectTest => {
    rejectTest.test('Set rejection_reason and default rejection_type', t => {
      let rejectionReason = 'rejection reason'
      let result = Events.TransferRejected({ rejection_reason: rejectionReason })
      t.equal(result.rejection_reason, rejectionReason)
      t.end()
    })

    rejectTest.test('Set rejection_reason and rejection_type', t => {
      let rejectionReason = 'rejection reason'
      let result = Events.TransferRejected({ rejection_reason: rejectionReason })
      t.equal(result.rejection_reason, rejectionReason)
      t.end()
    })
    rejectTest.end()
  })

  eventsTest.test('TransferSettled should', settledTest => {
    settledTest.test('Set settlement_id', t => {
      let settlementId = 'settlement_id'
      let result = Events.TransferSettled({ settlement_id: settlementId })
      t.equal(result.settlement_id, settlementId)
      t.end()
    })
    settledTest.end()
  })
  eventsTest.end()
})
