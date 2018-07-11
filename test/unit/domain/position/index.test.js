'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Config = require(`${src}/lib/config`)
const Service = require(`${src}/domain/position`)
const Participant = require(`${src}/domain/participant`)
const Fee = require(`${src}/domain/fee`)
const SettleableTransfersReadModel = require(`${src}/models/settleable-transfers-read-model`)

Test('Position Service tests', (serviceTest) => {
  let sandbox
  let originalHostName
  let hostname = 'http://some-host'
  let participant = [{ participantId: 1, name: 'dfsp1' }, { participantId: 2, name: 'dfsp2' }, { participantId: 3, name: 'dfsp3' }, { participantId: 4, name: 'dfsp4' }]

  serviceTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    sandbox.stub(Participant, 'getAll')
    sandbox.stub(Participant, 'getById')
    sandbox.stub(SettleableTransfersReadModel, 'getUnsettledTransfers')
    sandbox.stub(SettleableTransfersReadModel, 'getUnsettledTransfersByParticipant')
    sandbox.stub(Fee, 'getUnsettledFeeByParticipant')
    sandbox.stub(Fee, 'getUnsettledFee')
    Participant.getAll.returns(P.resolve(participant))
    t.end()
  })

  serviceTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  function buildEmptyPosition (participantName) {
    return buildPosition(participantName, '0', '0', '0', '0', '0', '0', '0')
  }

  function buildPosition (participantName, tPayments, tReceipts, tNet, fPayments, fReceipts, fNet, net) {
    return {
      participant: `${hostname}/participants/${participantName}`,
      fee: {
        payments: fPayments,
        receipts: fReceipts,
        net: fNet
      },
      transfers: {
        payments: tPayments,
        receipts: tReceipts,
        net: tNet
      },
      net: net
    }
  }

  function buildTransfer (debitParticipant, payeeAmount, creditParticipant, payerAmount) {
    return {
      debitParticipantName: debitParticipant,
      payeeAmount: payeeAmount,
      creditParticipantName: creditParticipant,
      payerAmount: payerAmount
    }
  }

  function buildFee (payerParticipant, payerAmount, payeeParticipant, payeeAmount) {
    return {
      payerParticipantName: payerParticipant,
      payerAmount: payerAmount,
      payeeParticipantName: payeeParticipant,
      payeeAmount: payeeAmount
    }
  }

  serviceTest.test('calculateForAllParticipants should', (calcAllTest) => {
    calcAllTest.test('return no positions if no participant retrieved', (test) => {
      Participant.getAll.returns(P.resolve([]))

      let transfers = [
        buildTransfer(participant[0].name, 3, participant[1].name, 3)
      ]

      SettleableTransfersReadModel.getUnsettledTransfers.returns(P.resolve(transfers))
      Fee.getUnsettledFee.returns(P.resolve([]))

      let expected = []
      Service.calculateForAllParticipants()
        .then(positions => {
          test.ok(Participant.getAll.called)
          test.notOk(SettleableTransfersReadModel.getUnsettledTransfers.called)
          test.notOk(Fee.getUnsettledFee.called)
          test.deepEqual(positions, expected)
          test.end()
        })
    })

    calcAllTest.test('return empty positions for all participant if no settleable transfers', (assert) => {
      let expected = [
        buildEmptyPosition(participant[0].name),
        buildEmptyPosition(participant[1].name),
        buildEmptyPosition(participant[2].name),
        buildEmptyPosition(participant[3].name)
      ]

      SettleableTransfersReadModel.getUnsettledTransfers.returns(P.resolve([]))
      Fee.getUnsettledFee.returns(P.resolve([]))

      Service.calculateForAllParticipants()
        .then(positions => {
          assert.ok(Participant.getAll.called)
          assert.ok(SettleableTransfersReadModel.getUnsettledTransfers.called)
          assert.ok(Fee.getUnsettledFee.called)
          assert.equal(positions.length, participant.length)
          assert.deepEqual(positions, expected)
          assert.end()
        })
    })

    calcAllTest.test('return expected positions if settleable transfers exist', (assert) => {
      let transfers = [
        buildTransfer(participant[0].name, 3, participant[1].name, 3),
        buildTransfer(participant[0].name, 2, participant[2].name, 2)
      ]
      let fee = [
        buildFee(participant[0].name, 1, participant[1].name, 1),
        buildFee(participant[2].name, 6, participant[0].name, 6)
      ]

      SettleableTransfersReadModel.getUnsettledTransfers.returns(P.resolve(transfers))
      Fee.getUnsettledFee.returns(P.resolve(fee))

      let expected = [
        buildPosition(participant[0].name, '5', '0', '-5', '1', '6', '5', '0'),
        buildPosition(participant[1].name, '0', '3', '3', '0', '1', '1', '4'),
        buildPosition(participant[2].name, '0', '2', '2', '6', '0', '-6', '-4'),
        buildEmptyPosition(participant[3].name)
      ]

      Service.calculateForAllParticipants()
        .then(positions => {
          assert.ok(Participant.getAll.called)
          assert.ok(SettleableTransfersReadModel.getUnsettledTransfers.calledOnce)
          assert.ok(Fee.getUnsettledFee.calledOnce)
          assert.deepEqual(positions, expected)
          assert.end()
        })
    })

    calcAllTest.end()
  })

  serviceTest.test('calculateForParticipant should', (calcParticipantTest) => {
    calcParticipantTest.test('return empty positions for participant if no settleable transfers or fee', (test) => {
      const expected = {
        participant: `${hostname}/participants/${participant[0].name}`,
        fee: {
          payments: '0',
          receipts: '0',
          net: '0'
        },
        transfers: {
          payments: '0',
          receipts: '0',
          net: '0'
        },
        net: '0'
      }
      const participant = {
        name: 'dfsp1',
        id: 11
      }
      SettleableTransfersReadModel.getUnsettledTransfersByParticipant.returns(P.resolve([]))
      Fee.getUnsettledFeeByParticipant.returns(P.resolve([]))

      Service.calculateForParticipant(participant)
        .then(positions => {
          test.ok(SettleableTransfersReadModel.getUnsettledTransfersByParticipant.called)
          test.ok(Fee.getUnsettledFeeByParticipant.called)
          test.deepEqual(positions, expected)
          test.end()
        })
    })

    calcParticipantTest.test('return expected positions if settleable transfers and fee exist', (test) => {
      let transfers = [
        buildTransfer(participant[0].name, 10, participant[1].name, 10),
        buildTransfer(participant[1].name, 5, participant[0].name, 5)
      ]
      let fee = [
        buildFee(participant[0].name, 1, participant[1].name, 1),
        buildFee(participant[2].name, 6, participant[0].name, 6)
      ]

      SettleableTransfersReadModel.getUnsettledTransfersByParticipant.returns(P.resolve(transfers))
      Fee.getUnsettledFeeByParticipant.returns(P.resolve(fee))

      let expected = {
        participant: `${hostname}/participants/${participant[0].name}`,
        fee: {
          payments: '1',
          receipts: '6',
          net: '5'
        },
        transfers: {
          payments: '10',
          receipts: '5',
          net: '-5'
        },
        net: '0'
      }
      const participant = {
        name: 'dfsp1',
        id: 11
      }
      Service.calculateForParticipant(participant)
        .then(positions => {
          test.ok(SettleableTransfersReadModel.getUnsettledTransfersByParticipant.calledOnce)
          test.ok(Fee.getUnsettledFeeByParticipant.calledOnce)
          test.deepEqual(positions, expected)
          test.end()
        })
    })

    calcParticipantTest.end()
  })

  serviceTest.end()
})
