'use strict'

const src = '../../../src'
const Test = require('tape')
const Uuid = require('uuid4')
const ExecutedTransfersModel = require(`${src}/models/executed-transfers`)
const SettledTransfersModel = require(`${src}/models/settled-transfers`)
const Participant = require(`${src}/domain/participant`)
const TransfersReadModel = require(`${src}/models/transfer/facade`)
const ReadModel = require(`${src}/models/settleable-transfers-read-model`)
const Fixtures = require('../../fixtures')
const TransferState = require(`${src}/domain/transfer/state`)

Test('transfers read model', function (modelTest) {
  modelTest.test('getSettleableTransfers should', function (getSettleableTransfersTest) {
    getSettleableTransfersTest.test('retrieve transfer ids that are executed but not settled', function (assert) {
      let settledTransferId = Fixtures.generateTransferId()
      let settledpayerParticipantId
      let settledCreditParticipantName = Fixtures.generateParticipantName()
      let settledpayeeParticipantId
      let settledDebitParticipantName = Fixtures.generateParticipantName()
      let settledpayerAmount = '11'
      let settledpayeeAmount = '-11'

      let unSettledTransferId = Fixtures.generateTransferId()
      let unSettledpayerParticipantId
      let unSettledCreditParticipantName = Fixtures.generateParticipantName()
      let unSettledpayeeParticipantId
      let unSettledDebitParticipantName = Fixtures.generateParticipantName()
      let unSettledpayerAmount = '50'
      let unSettledpayeeAmount = '-50'

      ExecutedTransfersModel.create({ id: unSettledTransferId })
        .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
        .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId: Uuid() }))
        .then(() => Participant.create({ name: unSettledCreditParticipantName, password: '1234', emailAddress: unSettledCreditParticipantName + '@test.com' }).then(participant => { unSettledpayerParticipantId = participant.participantId }))
        .then(() => Participant.create({ name: unSettledDebitParticipantName, password: '1234', emailAddress: unSettledDebitParticipantName + '@test.com' }).then(participant => { unSettledpayeeParticipantId = participant.participantId }))
        .then(() => Participant.create({ name: settledCreditParticipantName, password: '1234', emailAddress: settledCreditParticipantName + '@test.com' }).then(participant => { settledpayerParticipantId = participant.participantId }))
        .then(() => Participant.create({ name: settledDebitParticipantName, password: '1234', emailAddress: settledDebitParticipantName + '@test.com' }).then(participant => { settledpayeeParticipantId = participant.participantId }))
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(unSettledCreditParticipantName, unSettledpayerAmount)
          credit.participantId = unSettledpayerParticipantId
          let debit = Fixtures.buildDebitOrCredit(unSettledDebitParticipantName, unSettledpayeeAmount)
          debit.participantId = unSettledpayeeParticipantId
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(settledCreditParticipantName, settledpayerAmount)
          credit.participantId = settledpayerParticipantId
          let debit = Fixtures.buildDebitOrCredit(settledDebitParticipantName, settledpayeeAmount)
          debit.participantId = settledpayeeParticipantId
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(settledTransferId, credit, debit, TransferState.EXECUTED))
        })
        .then(() =>
          ReadModel.getUnsettledTransfers().then(result => {
            assert.notOk(result.find(x => x.transferId === settledTransferId))
            assert.ok(result.find(x => x.transferId === unSettledTransferId))
            assert.end()
          }))
    })

    getSettleableTransfersTest.end()
  })

  modelTest.test('getSettleableTransfersByParticipant should', function (getSettleableTransfersByParticipantTest) {
    getSettleableTransfersByParticipantTest.test('retrieve transfer ids for a specified participant that are executed but not settled', function (assert) {
      let participant1Name = Fixtures.generateParticipantName()
      let participant2Name = Fixtures.generateParticipantName()
      let participant3Name = Fixtures.generateParticipantName()

      let participant1Id
      let participant2Id
      let participant3Id

      let settledTransferId = Fixtures.generateTransferId()
      let settledpayerAmount = '11'
      let settledpayeeAmount = '-11'

      let unSettledTransferId = Fixtures.generateTransferId()
      let unSettledpayerAmount = '50'
      let unSettledpayeeAmount = '-50'

      let unSettledOtherTransferId = Fixtures.generateTransferId()
      let unSettledOtherpayerAmount = '5'
      let unSettledOtherpayeeAmount = '-5'

      ExecutedTransfersModel.create({ id: unSettledTransferId })
        .then(() => ExecutedTransfersModel.create({ id: unSettledOtherTransferId }))
        .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
        .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId: Uuid() }))
        .then(() => Participant.create({ name: participant1Name, password: '1234', emailAddress: participant1Name + '@test.com' }).then(participant => { participant1Id = participant.participantId }))
        .then(() => Participant.create({ name: participant2Name, password: '1234', emailAddress: participant2Name + '@test.com' }).then(participant => { participant2Id = participant.participantId }))
        .then(() => Participant.create({ name: participant3Name, password: '1234', emailAddress: participant3Name + '@test.com' }).then(participant => { participant3Id = participant.participantId }))
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(participant1Name, unSettledpayerAmount)
          credit.participantId = participant1Id
          let debit = Fixtures.buildDebitOrCredit(participant2Name, unSettledpayeeAmount)
          debit.participantId = participant2Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(participant2Name, unSettledOtherpayerAmount)
          credit.participantId = participant2Id
          let debit = Fixtures.buildDebitOrCredit(participant3Name, unSettledOtherpayeeAmount)
          debit.participantId = participant3Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledOtherTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(participant3Name, settledpayerAmount)
          credit.participantId = participant3Id
          let debit = Fixtures.buildDebitOrCredit(participant1Name, settledpayeeAmount)
          debit.participantId = participant1Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(settledTransferId, credit, debit, TransferState.EXECUTED))
        })
        .then(() =>
          ReadModel.getUnsettledTransfersByParticipant(participant1Id).then(result => {
            assert.notOk(result.find(x => x.transferId === settledTransferId))
            assert.notOk(result.find(x => x.transferId === unSettledOtherTransferId))
            assert.ok(result.find(x => x.transferId === unSettledTransferId))
            assert.end()
          }))
    })

    getSettleableTransfersByParticipantTest.end()
  })

  modelTest.end()
})
