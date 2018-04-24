'use strict'

const src = '../../../../src'
const Test = require('tape')
const P = require('bluebird')
const Uuid = require('uuid4')
const Fixtures = require('../../../fixtures')
const ExecutedTransfersModel = require(`${src}/models/executed-transfers`)
const SettledTransfersModel = require(`${src}/models/settled-transfers`)
const SettledFeeModel = require(`${src}/models/settled-fee`)
const FeeModel = require(`${src}/domain/fee/model`)
const Account = require(`${src}/domain/account`)

function generateFeePayload (data) {
  return {
    transferId: data.transferId || Uuid(),
    amount: data.amount || '10.00',
    payerParticipantId: data.payerParticipantId || 1,
    payeeParticipantId: data.payeeParticipantId || 2,
    chargeId: data.chargeId || 1
  }
}

Test('fee model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new fee', test => {
      const payload = generateFeePayload({ chargeId: 1 })

      FeeModel.create(payload)
        .then((fee) => {
          test.equal(fee.transferId, payload.transferId)
          test.equal(fee.amount, payload.amount)
          test.equal(fee.payerParticipantId, payload.payerParticipantId)
          test.equal(fee.payeeParticipantId, payload.payeeParticipantId)
          test.equal(fee.chargeId, payload.chargeId)
          test.ok(fee.createdDate)
          test.ok(fee.feeId)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('getAllForTransfer should', getAllForTransferTest => {
    getAllForTransferTest.test('return all fee for a transfer', test => {
      let transferId = Uuid()
      const feePayload1 = generateFeePayload({ transferId, chargeId: 1 })
      const feePayload2 = generateFeePayload({ transferId, chargeId: 2 })
      const transfer = {
        transferId: transferId
      }

      FeeModel.create(feePayload1)
        .then(() => FeeModel.create(feePayload2))
        .then(() => FeeModel.getAllForTransfer(transfer))
        .then((fee) => {
          test.ok(fee.length >= 2)
          test.ok(fee.find(a => a.chargeId === feePayload1.chargeId))
          test.ok(fee.find(a => a.chargeId === feePayload2.chargeId))
          test.end()
        })
    })

    getAllForTransferTest.end()
  })

  modelTest.test('doesExist should', doesExistTest => {
    doesExistTest.test('return fee for a transfer and charge', test => {
      let transferId = Uuid()
      const feePayload1 = generateFeePayload({ transferId, chargeId: 1 })
      const feePayload2 = generateFeePayload({ transferId, chargeId: 2 })
      const charge = { chargeId: feePayload2.chargeId }

      const transfer = {
        transferId: transferId
      }

      FeeModel.create(feePayload1)
        .then(() => FeeModel.create(feePayload2))
        .then(() => FeeModel.doesExist(charge, transfer))
        .then(fee => {
          test.ok(fee)
          test.equal(fee.chargeId, charge.chargeId)
          test.equal(fee.transferId, transfer.transferId)
          test.end()
        })
    })

    doesExistTest.test('return null if fee doesn\'t exist', test => {
      let transferId = Uuid()
      const feePayload = generateFeePayload({ transferId, chargeId: 1 })
      const charge = { chargeId: 3 }

      const transfer = {
        transferId: transferId
      }

      FeeModel.create(feePayload)
        .then(() => FeeModel.doesExist(charge, transfer))
        .then(fee => {
          test.notOk(fee)
          test.end()
        })
    })

    doesExistTest.end()
  })

  modelTest.test('getSettleableFeeByAccount should', getSettleableFeeByAccountTest => {
    getSettleableFeeByAccountTest.test('retrieve fee ids for a specified account that are attached to transfers that are executed but not settled', test => {
      const account1Name = Fixtures.generateAccountName()
      const account2Name = Fixtures.generateAccountName()
      const account3Name = Fixtures.generateAccountName()

      P.all([Account.create({ name: account1Name, password: '1234', emailAddress: account1Name + '@test.com' }), Account.create({ name: account2Name, password: '1234', emailAddress: account2Name + '@test.com' }), Account.create({ name: account3Name, password: '1234', emailAddress: account3Name + '@test.com' })]).then(([account1, account2, account3]) => {
        const unsettledTransferId = Fixtures.generateTransferId()
        const settledTransferId = Fixtures.generateTransferId()
        const unsettledOtherTransferId = Fixtures.generateTransferId()

        const unsettledFee = generateFeePayload({ transferId: unsettledTransferId, payerParticipantId: account1.accountId, payeeParticipantId: account2.accountId })
        const settledFee = generateFeePayload({ transferId: settledTransferId, payerParticipantId: account2.accountId, payeeParticipantId: account1.accountId })
        const otherUnsettledFee = generateFeePayload({ transferId: unsettledOtherTransferId, payerParticipantId: account2.accountId, payeeParticipantId: account3.accountId })
        const settlementId = Uuid()

        return ExecutedTransfersModel.create({ id: unsettledTransferId })
          .then(() => ExecutedTransfersModel.create({ id: unsettledOtherTransferId }))
          .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
          .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId }))
          .then(() => P.all([FeeModel.create(unsettledFee), FeeModel.create(settledFee), FeeModel.create(otherUnsettledFee)]))
          .then(([fee1, fee2, fee3]) => {
            return SettledFeeModel.create({ feeId: fee2.feeId, settlementId }).then(() => {
              return FeeModel.getUnsettledFeeByAccount(account1).then(result => {
                test.notOk(result.find(x => x.feeId === fee3.feeId))
                test.notOk(result.find(x => x.feeId === fee2.feeId))
                test.ok(result.find(x => x.feeId === fee1.feeId))
                test.end()
              })
            })
          })
      })
    })

    getSettleableFeeByAccountTest.end()
  })

  modelTest.test('getSettleableFeeForTransfer should', getSettleableFeeForTransferTest => {
    getSettleableFeeForTransferTest.test('retrieve all fee ids that are attached to transfers that are executed but not settled', test => {
      const account1Name = Fixtures.generateAccountName()
      const account2Name = Fixtures.generateAccountName()
      const account3Name = Fixtures.generateAccountName()

      P.all([Account.create({ name: account1Name, password: '1234', emailAddress: account1Name + '@test.com' }), Account.create({ name: account2Name, password: '1234', emailAddress: account2Name + '@test.com' }), Account.create({ name: account3Name, password: '1234', emailAddress: account1Name + '@test.com' })]).then(([account1, account2, account3]) => {
        const unsettledTransferId = Fixtures.generateTransferId()
        const settledTransferId = Fixtures.generateTransferId()
        const unsettledOtherTransferId = Fixtures.generateTransferId()

        const unsettledFee = generateFeePayload({ transferId: unsettledTransferId, payerParticipantId: account1.accountId, payeeParticipantId: account2.accountId })
        const settledFee = generateFeePayload({ transferId: settledTransferId, payerParticipantId: account2.accountId, payeeParticipantId: account1.accountId })
        const otherUnsettledFee = generateFeePayload({ transferId: unsettledOtherTransferId, payerParticipantId: account2.accountId, payeeParticipantId: account3.accountId })
        const settlementId = Uuid()

        return ExecutedTransfersModel.create({ id: unsettledTransferId })
          .then(() => ExecutedTransfersModel.create({ id: unsettledOtherTransferId }))
          .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
          .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId }))
          .then(() => P.all([FeeModel.create(unsettledFee), FeeModel.create(settledFee), FeeModel.create(otherUnsettledFee)]))
          .then(([fee1, fee2, fee3]) => {
            return SettledFeeModel.create({ feeId: fee2.feeId, settlementId }).then(() => {
              return FeeModel.getUnsettledFee().then(result => {
                test.ok(result.find(x => x.feeId === fee3.feeId))
                test.notOk(result.find(x => x.feeId === fee2.feeId))
                test.ok(result.find(x => x.feeId === fee1.feeId))
                test.end()
              })
            })
          })
      })

      getSettleableFeeForTransferTest.end()
    })
  })

  modelTest.end()
})
