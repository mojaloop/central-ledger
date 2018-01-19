'use strict'

const src = '../../../../src'
const Test = require('tape')
const P = require('bluebird')
const Uuid = require('uuid4')
const Fixtures = require('../../../fixtures')
const ExecutedTransfersModel = require(`${src}/models/executed-transfers`)
const SettledTransfersModel = require(`${src}/models/settled-transfers`)
const SettledFeesModel = require(`${src}/models/settled-fees`)
const FeesModel = require(`${src}/domain/fee/model`)
const Account = require(`${src}/domain/account`)

function generateFeePayload (data) {
  return {
    transferId: data.transferId || Uuid(),
    amount: data.amount || '10.00',
    payerAccountId: data.payerAccountId || 1,
    payeeAccountId: data.payeeAccountId || 2,
    chargeId: data.chargeId || 1
  }
}

Test('fees model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new fee', test => {
      const payload = generateFeePayload({ chargeId: 1 })

      FeesModel.create(payload)
        .then((fee) => {
          test.equal(fee.transferId, payload.transferId)
          test.equal(fee.amount, payload.amount)
          test.equal(fee.payerAccountId, payload.payerAccountId)
          test.equal(fee.payeeAccountId, payload.payeeAccountId)
          test.equal(fee.chargeId, payload.chargeId)
          test.ok(fee.createdDate)
          test.ok(fee.feeId)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('getAllForTransfer should', getAllForTransferTest => {
    getAllForTransferTest.test('return all fees for a transfer', test => {
      let transferId = Uuid()
      const feePayload1 = generateFeePayload({ transferId, chargeId: 1 })
      const feePayload2 = generateFeePayload({ transferId, chargeId: 2 })
      const transfer = {
        transferUuid: transferId
      }

      FeesModel.create(feePayload1)
        .then(() => FeesModel.create(feePayload2))
        .then(() => FeesModel.getAllForTransfer(transfer))
        .then((fees) => {
          test.ok(fees.length >= 2)
          test.ok(fees.find(a => a.chargeId === feePayload1.chargeId))
          test.ok(fees.find(a => a.chargeId === feePayload2.chargeId))
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
        transferUuid: transferId
      }

      FeesModel.create(feePayload1)
        .then(() => FeesModel.create(feePayload2))
        .then(() => FeesModel.doesExist(charge, transfer))
        .then(fee => {
          test.ok(fee)
          test.equal(fee.chargeId, charge.chargeId)
          test.equal(fee.transferId, transfer.transferUuid)
          test.end()
        })
    })

    doesExistTest.test('return null if fee doesn\'t exist', test => {
      let transferId = Uuid()
      const feePayload = generateFeePayload({ transferId, chargeId: 1 })
      const charge = { chargeId: 3 }

      const transfer = {
        transferUuid: transferId
      }

      FeesModel.create(feePayload)
        .then(() => FeesModel.doesExist(charge, transfer))
        .then(fee => {
          test.notOk(fee)
          test.end()
        })
    })

    doesExistTest.end()
  })

  modelTest.test('getSettleableFeesByAccount should', getSettleableFeesByAccountTest => {
    getSettleableFeesByAccountTest.test('retrieve fee ids for a specified account that are attached to transfers that are executed but not settled', test => {
      const account1Name = Fixtures.generateAccountName()
      const account2Name = Fixtures.generateAccountName()
      const account3Name = Fixtures.generateAccountName()

      P.all([Account.create({ name: account1Name, password: '1234', emailAddress: account1Name + '@test.com' }), Account.create({ name: account2Name, password: '1234', emailAddress: account2Name + '@test.com' }), Account.create({ name: account3Name, password: '1234', emailAddress: account3Name + '@test.com' })]).then(([account1, account2, account3]) => {
        const unsettledTransferId = Fixtures.generateTransferId()
        const settledTransferId = Fixtures.generateTransferId()
        const unsettledOtherTransferId = Fixtures.generateTransferId()

        const unsettledFee = generateFeePayload({ transferId: unsettledTransferId, payerAccountId: account1.accountId, payeeAccountId: account2.accountId })
        const settledFee = generateFeePayload({ transferId: settledTransferId, payerAccountId: account2.accountId, payeeAccountId: account1.accountId })
        const otherUnsettledFee = generateFeePayload({ transferId: unsettledOtherTransferId, payerAccountId: account2.accountId, payeeAccountId: account3.accountId })
        const settlementId = Uuid()

        return ExecutedTransfersModel.create({ id: unsettledTransferId })
          .then(() => ExecutedTransfersModel.create({ id: unsettledOtherTransferId }))
          .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
          .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId }))
          .then(() => P.all([FeesModel.create(unsettledFee), FeesModel.create(settledFee), FeesModel.create(otherUnsettledFee)]))
          .then(([fee1, fee2, fee3]) => {
            return SettledFeesModel.create({ feeId: fee2.feeId, settlementId }).then(() => {
              return FeesModel.getUnsettledFeesByAccount(account1).then(result => {
                test.notOk(result.find(x => x.feeId === fee3.feeId))
                test.notOk(result.find(x => x.feeId === fee2.feeId))
                test.ok(result.find(x => x.feeId === fee1.feeId))
                test.end()
              })
            })
          })
      })
    })

    getSettleableFeesByAccountTest.end()
  })

  modelTest.test('getSettleableFeesForTransfer should', getSettleableFeesForTransferTest => {
    getSettleableFeesForTransferTest.test('retrieve all fee ids that are attached to transfers that are executed but not settled', test => {
      const account1Name = Fixtures.generateAccountName()
      const account2Name = Fixtures.generateAccountName()
      const account3Name = Fixtures.generateAccountName()

      P.all([Account.create({ name: account1Name, password: '1234', emailAddress: account1Name + '@test.com' }), Account.create({ name: account2Name, password: '1234', emailAddress: account2Name + '@test.com' }), Account.create({ name: account3Name, password: '1234', emailAddress: account1Name + '@test.com' })]).then(([account1, account2, account3]) => {
        const unsettledTransferId = Fixtures.generateTransferId()
        const settledTransferId = Fixtures.generateTransferId()
        const unsettledOtherTransferId = Fixtures.generateTransferId()

        const unsettledFee = generateFeePayload({ transferId: unsettledTransferId, payerAccountId: account1.accountId, payeeAccountId: account2.accountId })
        const settledFee = generateFeePayload({ transferId: settledTransferId, payerAccountId: account2.accountId, payeeAccountId: account1.accountId })
        const otherUnsettledFee = generateFeePayload({ transferId: unsettledOtherTransferId, payerAccountId: account2.accountId, payeeAccountId: account3.accountId })
        const settlementId = Uuid()

        return ExecutedTransfersModel.create({ id: unsettledTransferId })
          .then(() => ExecutedTransfersModel.create({ id: unsettledOtherTransferId }))
          .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
          .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId }))
          .then(() => P.all([FeesModel.create(unsettledFee), FeesModel.create(settledFee), FeesModel.create(otherUnsettledFee)]))
          .then(([fee1, fee2, fee3]) => {
            return SettledFeesModel.create({ feeId: fee2.feeId, settlementId }).then(() => {
              return FeesModel.getUnsettledFees().then(result => {
                test.ok(result.find(x => x.feeId === fee3.feeId))
                test.notOk(result.find(x => x.feeId === fee2.feeId))
                test.ok(result.find(x => x.feeId === fee1.feeId))
                test.end()
              })
            })
          })
      })

      getSettleableFeesForTransferTest.end()
    })
  })

  modelTest.end()
})
