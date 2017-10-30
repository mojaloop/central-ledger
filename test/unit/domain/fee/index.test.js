'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require('../../../../src/domain/fee/model')
const FeeService = require('../../../../src/domain/fee')
const SettledFeeService = require('../../../../src/models/settled-fees')
const SettlementsModel = require('../../../../src/models/settlements')
const Charges = require('../../../../src/domain/charge')
const Account = require('../../../../src/domain/account')
const TransferQueries = require('../../../../src/domain/transfer/queries')
const Util = require('../../../../src/lib/util')
const Config = require('../../../../src/lib/config')

const createFee = (transfer, charge) => {
  return {
    transferId: transfer.transferUuid,
    amount: Util.formatAmount(charge.rate * transfer.creditAmount),
    payerAccountId: transfer.debitAccountId,
    payeeAccountId: transfer.creditAccountId,
    chargeId: charge.chargeId
  }
}

Test('Fee service', serviceTest => {
  let sandbox

  serviceTest.beforeEach(test => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'doesExist')
    sandbox.stub(Model, 'getAllForTransfer')
    sandbox.stub(Model, 'getUnsettledFeesByAccount')
    sandbox.stub(Model, 'getSettleableFeesForTransfer')
    sandbox.stub(Model, 'getUnsettledFees')
    sandbox.stub(SettlementsModel, 'create')
    sandbox.stub(SettledFeeService, 'create')
    sandbox.stub(Charges, 'getAllForTransfer')
    sandbox.stub(Account, 'getByName')
    sandbox.stub(TransferQueries, 'getById')
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    test.end()
  })

  serviceTest.afterEach(test => {
    sandbox.restore()
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    test.end()
  })

  serviceTest.test('generateFeesForTransfer should', generateTest => {
    generateTest.test('add fee in model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '0.50',
        payer: 'sender',
        payee: 'receiver'
      }
      const charge3 = {
        name: 'charge3',
        chargeId: '3',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'ledger'
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      const fee2 = createFee(transfer, charge2)

      const ledgerAccountId = '4'
      const fee3 = createFee(transfer, charge3)
      fee3.payeeAccountId = ledgerAccountId

      const event = {
        aggregate: {
          id: '012'
        }
      }

      const account = {
        accountId: ledgerAccountId
      }

      Charges.getAllForTransfer.returns(P.resolve([charge, charge2, charge3]))
      TransferQueries.getById.returns(P.resolve(transfer))
      Model.create.returns(P.resolve(fee))
      Model.doesExist.returns(P.resolve(null))
      Account.getByName.withArgs(Config.LEDGER_ACCOUNT_NAME).returns(P.resolve(account))
      FeeService.generateFeesForTransfer(event)
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
        payer: 'sender',
        payee: 'receiver'
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      const event = {
        aggregate: {
          id: '012'
        }
      }

      Charges.getAllForTransfer.returns(P.resolve([charge]))
      TransferQueries.getById.returns(P.resolve(transfer))
      Model.create.returns(P.resolve({}))
      Model.doesExist.returns(P.resolve(fee))
      FeeService.generateFeesForTransfer(event)
        .then(() => {
          test.ok(Model.create.notCalled)
          test.end()
        })
    })

    generateTest.end()
  })

  serviceTest.test('getAllForTransfer should', getAllForTransferTest => {
    getAllForTransferTest.test('return fees from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payer: 'sender',
        payee: 'receiver'
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fees = [fee1, fee2]

      Model.getAllForTransfer.returns(P.resolve(fees))
      FeeService.getAllForTransfer(transfer)
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerAccountId, fee1.payerAccountId)
          test.equal(result[0].payeeAccountId, fee1.payeeAccountId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerAccountId, fee2.payerAccountId)
          test.equal(result[1].payeeAccountId, fee2.payeeAccountId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getAllForTransferTest.end()
  })

  serviceTest.test('getUnsettledFees should', getUnsettledFeesTest => {
    getUnsettledFeesTest.test('return fees from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payer: 'sender',
        payee: 'receiver'
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fees = [fee1, fee2]

      Model.getUnsettledFees.returns(P.resolve(fees))
      FeeService.getUnsettledFees()
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerAccountId, fee1.payerAccountId)
          test.equal(result[0].payeeAccountId, fee1.payeeAccountId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerAccountId, fee2.payerAccountId)
          test.equal(result[1].payeeAccountId, fee2.payeeAccountId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getUnsettledFeesTest.end()
  })

  serviceTest.test('getUnsettledFeesByAccount should', getUnsettledFeesByAccountTest => {
    getUnsettledFeesByAccountTest.test('return settleable fees from Model by account', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'receiver'
      }
      const charge2 = {
        name: 'charge2',
        chargeId: '2',
        chargeType: 'fee',
        rateType: 'percent',
        rate: '.50',
        payer: 'sender',
        payee: 'receiver'
      }
      const account = {
        accountId: 11
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee1 = createFee(transfer, charge)
      fee1.feeId = 0
      const fee2 = createFee(transfer, charge2)
      fee2.feeId = 1
      const fees = [fee1, fee2]

      Model.getUnsettledFeesByAccount.returns(P.resolve(fees))
      FeeService.getUnsettledFeesByAccount(account)
        .then(result => {
          test.equal(result.length, 2)
          test.equal(result[0].feeId, fee1.feeId)
          test.equal(result[0].transferId, fee1.transferId)
          test.equal(result[0].amount, fee1.amount)
          test.equal(result[0].payerAccountId, fee1.payerAccountId)
          test.equal(result[0].payeeAccountId, fee1.payeeAccountId)
          test.equal(result[0].chargeId, fee1.chargeId)
          test.equal(result[1].feeId, fee2.feeId)
          test.equal(result[1].transferId, fee2.transferId)
          test.equal(result[1].amount, fee2.amount)
          test.equal(result[1].payerAccountId, fee2.payerAccountId)
          test.equal(result[1].payeeAccountId, fee2.payeeAccountId)
          test.equal(result[1].chargeId, fee2.chargeId)
          test.end()
        })
    })

    getUnsettledFeesByAccountTest.end()
  })

  serviceTest.test('settleFee should', settleTest => {
    settleTest.test('return settled fee from Model', test => {
      const charge = {
        name: 'charge',
        chargeId: '1',
        chargeType: 'fee',
        rateType: 'flat',
        rate: '1.00',
        payer: 'sender',
        payee: 'receiver'
      }
      const transfer = {
        transferUuid: '012',
        debitAccountId: '1',
        creditAccountId: '2',
        creditAmount: '1.00',
        debitAmount: '1.00'
      }
      const fee = createFee(transfer, charge)
      fee.feeId = 6
      const settlementId = '1234'

      Model.getSettleableFeesForTransfer.returns(P.resolve([fee]))
      SettlementsModel.create.returns(P.resolve({ settlementId }))
      SettledFeeService.create.returns(P.resolve({ feeId: fee.feeId, settlementId }))
      FeeService.settleFeesForTransfers(['1234', '1234'])
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
