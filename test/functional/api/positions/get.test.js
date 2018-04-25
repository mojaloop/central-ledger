'use strict'

const Test = require('tape')
const Base = require('../../base')
const Fixtures = require('../../../fixtures')

Test('GET /positions', getTest => {
  getTest.test('should return net positions', test => {
    let fulfillment = 'oAKAAA'
    let participant1Name = Fixtures.generateParticipantName()
    let participant2Name = Fixtures.generateParticipantName()
    let participant3Name = Fixtures.generateParticipantName()
    let participant4Name = Fixtures.generateParticipantName()

    let transfer1Id = Fixtures.generateTransferId()
    let transfer2Id = Fixtures.generateTransferId()
    let transfer3Id = Fixtures.generateTransferId()

    const chargePayload = Fixtures.buildCharge(Fixtures.generateRandomName(), 'flat', '006')
    chargePayload.minimum = '129.00'
    chargePayload.maximum = '131.00'
    chargePayload.rate = '1.00'

    Base.createParticipant(participant1Name)
      .then(() => Base.createParticipant(participant2Name))
      .then(() => Base.createParticipant(participant3Name))
      .then(() => Base.createParticipant(participant4Name))
      .then(() => Base.createCharge(chargePayload))
      .then(() => Base.prepareTransfer(transfer1Id, Fixtures.buildTransfer(transfer1Id, Fixtures.buildDebitOrCredit(participant1Name, '130'), Fixtures.buildDebitOrCredit(participant2Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer1Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer2Id, Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(participant1Name, '130'), Fixtures.buildDebitOrCredit(participant3Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer2Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer3Id, Fixtures.buildTransfer(transfer3Id, Fixtures.buildDebitOrCredit(participant3Name, '130'), Fixtures.buildDebitOrCredit(participant2Name, '130'))))
      .then(() => Base.fulfillTransfer(transfer3Id, fulfillment))
      .then(() => {
        Base.getApi('/positions')
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.deepEqual(Fixtures.findParticipantPositions(res.body.positions, participant1Name), Fixtures.buildParticipantPosition(participant1Name, 260, 0, 2, 0))
            test.deepEqual(Fixtures.findParticipantPositions(res.body.positions, participant2Name), Fixtures.buildParticipantPosition(participant2Name, 0, 260, 0, 2))
            test.deepEqual(Fixtures.findParticipantPositions(res.body.positions, participant3Name), Fixtures.buildParticipantPosition(participant3Name, 130, 130, 1, 1))
            test.deepEqual(Fixtures.findParticipantPositions(res.body.positions, participant4Name), Fixtures.buildParticipantPosition(participant4Name, 0, 0, 0, 0))
            test.end()
          })
      })
  })
  getTest.end()
})

Test('GET /positions/{name}', getTestParticipant => {
  getTestParticipant.test('should return net positions for participant', test => {
    let fulfillment = 'oAKAAA'
    let participant1Name = Fixtures.generateParticipantName()
    let participant2Name = Fixtures.generateParticipantName()
    let participant3Name = Fixtures.generateParticipantName()

    let transfer1Id = Fixtures.generateTransferId()
    let transfer2Id = Fixtures.generateTransferId()

    const chargePayload = Fixtures.buildCharge(Fixtures.generateRandomName(), 'flat', '005')
    chargePayload.minimum = '0.00'
    chargePayload.maximum = '10.00'

    Base.createParticipant(participant1Name)
      .then(() => Base.createParticipant(participant2Name))
      .then(() => Base.createParticipant(participant3Name))
      .then(() => Base.createCharge(chargePayload))
      .then(() => Base.prepareTransfer(transfer1Id, Fixtures.buildTransfer(transfer1Id, Fixtures.buildDebitOrCredit(participant1Name, '10'), Fixtures.buildDebitOrCredit(participant2Name, '10'))))
      .then(() => Base.fulfillTransfer(transfer1Id, fulfillment))
      .then(() => Base.prepareTransfer(transfer2Id, Fixtures.buildTransfer(transfer2Id, Fixtures.buildDebitOrCredit(participant1Name, '10'), Fixtures.buildDebitOrCredit(participant3Name, '10'))))
      .then(() => Base.fulfillTransfer(transfer2Id, fulfillment))
      .then(() => {
        Base.getApi(`/positions/${participant1Name}`)
          .expect(200)
          .expect('Content-Type', /json/)
          .then(res => {
            test.equal(res.body.participant, `http://central-ledger/participants/${participant1Name}`)
            test.equal(res.body.fee.payments, '1')
            test.equal(res.body.fee.receipts, '0')
            test.equal(res.body.fee.net, '-1')
            test.equal(res.body.transfers.payments, '20')
            test.equal(res.body.transfers.receipts, '0')
            test.equal(res.body.transfers.net, '-20')
            test.equal(res.body.net, '-21')
            test.end()
          })
      })
  })

  getTestParticipant.end()
})
