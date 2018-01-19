'use strict'

const src = '../../../src'
const Test = require('tape')
const Uuid = require('uuid4')
const ExecutedTransfersModel = require(`${src}/models/executed-transfers`)
const SettledTransfersModel = require(`${src}/models/settled-transfers`)
const Account = require(`${src}/domain/account`)
const TransfersReadModel = require(`${src}/domain/transfer/models/transfers-read-model`)
const ReadModel = require(`${src}/models/settleable-transfers-read-model`)
const Fixtures = require('../../fixtures')
const TransferState = require(`${src}/domain/transfer/state`)

Test('transfers read model', function (modelTest) {
  modelTest.test('getSettleableTransfers should', function (getSettleableTransfersTest) {
    getSettleableTransfersTest.test('retrieve transfer ids that are executed but not settled', function (assert) {
      let settledTransferId = Fixtures.generateTransferId()
      let settledCreditAccountId
      let settledCreditAccountName = Fixtures.generateAccountName()
      let settledDebitAccountId
      let settledDebitAccountName = Fixtures.generateAccountName()
      let settledCreditAmount = '11'
      let settledDebitAmount = '-11'

      let unSettledTransferId = Fixtures.generateTransferId()
      let unSettledCreditAccountId
      let unSettledCreditAccountName = Fixtures.generateAccountName()
      let unSettledDebitAccountId
      let unSettledDebitAccountName = Fixtures.generateAccountName()
      let unSettledCreditAmount = '50'
      let unSettledDebitAmount = '-50'

      ExecutedTransfersModel.create({ id: unSettledTransferId })
        .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
        .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId: Uuid() }))
        .then(() => Account.create({ name: unSettledCreditAccountName, password: '1234', emailAddress: unSettledCreditAccountName + '@test.com' }).then(account => { unSettledCreditAccountId = account.accountId }))
        .then(() => Account.create({ name: unSettledDebitAccountName, password: '1234', emailAddress: unSettledDebitAccountName + '@test.com' }).then(account => { unSettledDebitAccountId = account.accountId }))
        .then(() => Account.create({ name: settledCreditAccountName, password: '1234', emailAddress: settledCreditAccountName + '@test.com' }).then(account => { settledCreditAccountId = account.accountId }))
        .then(() => Account.create({ name: settledDebitAccountName, password: '1234', emailAddress: settledDebitAccountName + '@test.com' }).then(account => { settledDebitAccountId = account.accountId }))
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(unSettledCreditAccountName, unSettledCreditAmount)
          credit.accountId = unSettledCreditAccountId
          let debit = Fixtures.buildDebitOrCredit(unSettledDebitAccountName, unSettledDebitAmount)
          debit.accountId = unSettledDebitAccountId
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(settledCreditAccountName, settledCreditAmount)
          credit.accountId = settledCreditAccountId
          let debit = Fixtures.buildDebitOrCredit(settledDebitAccountName, settledDebitAmount)
          debit.accountId = settledDebitAccountId
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

  modelTest.test('getSettleableTransfersByAccount should', function (getSettleableTransfersByAccountTest) {
    getSettleableTransfersByAccountTest.test('retrieve transfer ids for a specified account that are executed but not settled', function (assert) {
      let account1Name = Fixtures.generateAccountName()
      let account2Name = Fixtures.generateAccountName()
      let account3Name = Fixtures.generateAccountName()

      let account1Id
      let account2Id
      let account3Id

      let settledTransferId = Fixtures.generateTransferId()
      let settledCreditAmount = '11'
      let settledDebitAmount = '-11'

      let unSettledTransferId = Fixtures.generateTransferId()
      let unSettledCreditAmount = '50'
      let unSettledDebitAmount = '-50'

      let unSettledOtherTransferId = Fixtures.generateTransferId()
      let unSettledOtherCreditAmount = '5'
      let unSettledOtherDebitAmount = '-5'

      ExecutedTransfersModel.create({ id: unSettledTransferId })
        .then(() => ExecutedTransfersModel.create({ id: unSettledOtherTransferId }))
        .then(() => ExecutedTransfersModel.create({ id: settledTransferId }))
        .then(() => SettledTransfersModel.create({ id: settledTransferId, settlementId: Uuid() }))
        .then(() => Account.create({ name: account1Name, password: '1234', emailAddress: account1Name + '@test.com' }).then(account => { account1Id = account.accountId }))
        .then(() => Account.create({ name: account2Name, password: '1234', emailAddress: account2Name + '@test.com' }).then(account => { account2Id = account.accountId }))
        .then(() => Account.create({ name: account3Name, password: '1234', emailAddress: account3Name + '@test.com' }).then(account => { account3Id = account.accountId }))
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(account1Name, unSettledCreditAmount)
          credit.accountId = account1Id
          let debit = Fixtures.buildDebitOrCredit(account2Name, unSettledDebitAmount)
          debit.accountId = account2Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(account2Name, unSettledOtherCreditAmount)
          credit.accountId = account2Id
          let debit = Fixtures.buildDebitOrCredit(account3Name, unSettledOtherDebitAmount)
          debit.accountId = account3Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(unSettledOtherTransferId, credit, debit, TransferState.EXECUTED)).catch(e => { assert.equals(e, '') })
        })
        .then(() => {
          let credit = Fixtures.buildDebitOrCredit(account3Name, settledCreditAmount)
          credit.accountId = account3Id
          let debit = Fixtures.buildDebitOrCredit(account1Name, settledDebitAmount)
          debit.accountId = account1Id
          return TransfersReadModel.saveTransfer(Fixtures.buildReadModelTransfer(settledTransferId, credit, debit, TransferState.EXECUTED))
        })
        .then(() =>
          ReadModel.getUnsettledTransfersByAccount(account1Id).then(result => {
            assert.notOk(result.find(x => x.transferId === settledTransferId))
            assert.notOk(result.find(x => x.transferId === unSettledOtherTransferId))
            assert.ok(result.find(x => x.transferId === unSettledTransferId))
            assert.end()
          }))
    })

    getSettleableTransfersByAccountTest.end()
  })

  modelTest.end()
})
