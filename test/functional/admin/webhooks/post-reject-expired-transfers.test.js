'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')
const State = require('../../../../src/domain/transfer/state')
const RejectionType = require('../../../../src/domain/transfer').rejectionType

Test('POST /webhooks/reject-expired-transfers', rejectTest => {
  rejectTest.test('should reject expired transfers', test => {
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'), Fixtures.getMomentToExpire())

    Base.prepareTransfer(transferId, transfer)
      .delay(1000)
      .then(() => {
        Base.postAdmin('/webhooks/reject-expired-transfers', {})
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(res.body, [transfer.id])
            test.end()
          })
      })
  })

  rejectTest.test('should set rejection_reason to expired', test => {
    let transferId = Fixtures.generateTransferId()
    let transfer = Fixtures.buildTransfer(transferId, Fixtures.buildDebitOrCredit(Base.participant1Name, '50'), Fixtures.buildDebitOrCredit(Base.participant2Name, '50'), Fixtures.getMomentToExpire())

    Base.prepareTransfer(transferId, transfer)
      .delay(1000)
      .then(() => Base.postAdmin('/webhooks/reject-expired-transfers', {}))
      .then(() => {
        Base.getTransfer(transferId)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.rejection_reason, RejectionType.EXPIRED)
            test.equal(res.body.state, State.REJECTED)
            test.end()
          })
      })
  })
  rejectTest.end()
})
