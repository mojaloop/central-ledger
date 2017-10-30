'use strict'

const Test = require('tape')
const RejectionType = require('../../../../src/domain/transfer/rejection-type')

Test('Rejection Type values', test => {
  test.equal(RejectionType.EXPIRED, 'expired')
  test.equal(RejectionType.CANCELLED, 'cancelled')
  test.equal(Object.keys(RejectionType).length, 2)
  test.end()
})
