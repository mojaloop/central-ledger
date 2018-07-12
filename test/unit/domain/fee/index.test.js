'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require('../../../../src/domain/fee/model')
const FeeService = require('../../../../src/domain/fee')
const SettledFeeService = require('../../../../src/models/settled-fee')
const SettlementModel = require('../../../../src/models/settlement')
const Charge = require('../../../../src/domain/charge')
const Participant = require('../../../../src/domain/participant')
const TransferService = require('../../../../src/domain/transfer')
const Util = require('../../../../src/lib/util')
const Config = require('../../../../src/lib/config')

const createFee = (transfer, charge) => {
  return {
    transferId: transfer.transferId,
    amount: Util.formatAmount(charge.rate * transfer.payerAmount),
    payerParticipantId: transfer.payeeParticipantId,
    payeeParticipantId: transfer.payerParticipantId,
    chargeId: charge.chargeId
  }
}

Test('Fee service', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'doesExist')
    sandbox.stub(Model, 'getAllForTransfer')
    sandbox.stub(Model, 'getUnsettledFeeByParticipant')
    sandbox.stub(Model, 'getSettleableFeeForTransfer')
    sandbox.stub(Model, 'getUnsettledFee')
    sandbox.stub(SettlementModel, 'create')
    sandbox.stub(SettledFeeService, 'create')
    sandbox.stub(Charge, 'getAllForTransfer')
    sandbox.stub(Participant, 'getByName')
    sandbox.stub(TransferService, 'getById')
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    test.end()
  })

  serviceTest.test('generateFeeForTransfer should', generateTest => {
    generateTest.test('add fee in model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '0.50',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const charge3 = {
        name: 'charge3',
        chargeId: '3',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'ledger'
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      const fee2 = createFee(transfer, charge2)

      const ledgerParticipantId = '4'
      const fee3 = createFee(transfer, charge3)
      fee3.payeeParticipantId = ledgerParticipantId

      const event = {
        aggregate: {
          id: '012'
        }
      }

      const participant = {
        participantId: ledgerParticipantId
      }

      Charge.getAllForTransfer.returns(P.resolve([charge, charge2, charge3]))
      TransferService.getById.returns(P.resolve(transfer))
      Model.create.returns(P.resolve(fee))
      Model.doesExist.returns(P.resolve(null))
      Participant.getByName.withArgs(Config.LEDGER_ACCOUNT_NAME).returns(P.resolve(participant))
      FeeService.generateFeeForTransfer(event)
        .then(result => {
          test.deepEqual(Model.create.firstCall.args[0], fee)
          test.deepEqual(Model.create.secondCall.args[0], fee2)
          test.deepEqual(Model.create.thirdCall.args[0], fee3)
          test.deepEqual(result, [fee, fee, fee])
          test.end()
        })
    })

    generateTest.test('not add fee in model if it already exists', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      const event = {
        aggregate: {
          id: '012'
        }
      }

      Charge.getAllForTransfer.returns(P.resolve([charge]))
      TransferService.getById.returns(P.resolve(transfer))
      Model.create.returns(P.resolve({}))
      Model.doesExist.returns(P.resolve(fee))
      FeeService.generateFeeForTransfer(event)
        .then(() => {
          test.ok(Model.create.notCalled)
          test.end()
        })
    })

    generateTest.end()
  })

  serviceTest.test('getAllForTransfer should', getAllForTransferTest => {
    getAllForTransferTest.test('return fee from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fee = [fee1, fee2]

      Model.getAllForTransfer.returns(P.resolve(fee))
      FeeService.getAllForTransfer(transfer)
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerParticipantId, fee1.payerParticipantId)
          test.equal(result[0].payeeParticipantId, fee1.payeeParticipantId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerParticipantId, fee2.payerParticipantId)
          test.equal(result[1].payeeParticipantId, fee2.payeeParticipantId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getAllForTransferTest.end()
  })

  serviceTest.test('getUnsettledFee should', getUnsettledFeeTest => {
    getUnsettledFeeTest.test('return fee from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fee = [fee1, fee2]

      Model.getUnsettledFee.returns(P.resolve(fee))
      FeeService.getUnsettledFee()
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerParticipantId, fee1.payerParticipantId)
          test.equal(result[0].payeeParticipantId, fee1.payeeParticipantId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerParticipantId, fee2.payerParticipantId)
          test.equal(result[1].payeeParticipantId, fee2.payeeParticipantId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getUnsettledFeeTest.end()
  })

  serviceTest.test('getUnsettledFeeByParticipant should', getUnsettledFeeByParticipantTest => {
    getUnsettledFeeByParticipantTest.test('return settleable fee from Model by participant', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const participant = {
        participantId: 11
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fee = [fee1, fee2]

      Model.getUnsettledFeeByParticipant.returns(P.resolve(fee))
      FeeService.getUnsettledFeeByParticipant(participant)
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerParticipantId, fee1.payerParticipantId)
          test.equal(result[0].payeeParticipantId, fee1.payeeParticipantId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerParticipantId, fee2.payerParticipantId)
          test.equal(result[1].payeeParticipantId, fee2.payeeParticipantId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getUnsettledFeeByParticipantTest.end()
  })

  serviceTest.test('settleFee should', settleTest => {
    settleTest.test('return settled fee from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payerParticipantId: 'sender',
        payeeParticipantId: 'receiver'
      }
      const transfer = {
        transferId: '012',
        payeeParticipantId: '1',
        payerParticipantId: '2',
        payerAmount: '1.00',
        payeeAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      fee.feeId = 6
      const settlementId = '1234'

      Model.getSettleableFeeForTransfer.returns(P.resolve([fee]))
      SettlementModel.create.returns(P.resolve({ settlementId }))
      SettledFeeService.create.returns(P.resolve({ feeId: fee.feeId, settlementId }))
      FeeService.settleFeeForTransfers(['1234', '1234'])
        .then(result => {
          test.equal(result.length, 1)
          test.deepEqual(result[0], fee)
          test.end()
        })
    })

    settleTest.end()
  })

  serviceTest.end()
})
