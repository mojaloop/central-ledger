'use strict'

const src = '../../../../../src'
const _ = require('lodash')
const P = require('bluebird')
const Test = require('tape')
const Moment = require('moment')
const Db = require(`${src}/db`)
const Account = require(`${src}/domain/account`)
const ReadModel = require(`${src}/domain/transfer/models/transfers-read-model`)
const Fixtures = require('../../../../fixtures')
const TransferState = require('../../../../../src/domain/transfer/state')

let pastDate = () => {
  let d = new Date()
  d.setDate(d.getDate() - 5)
  return d
}

const getTransfersCount = () => {
  return Db.transfers.count({}, '*')
}

const createAccounts = (accountNames) => {
  return P.all(accountNames.map(name => Account.create({ name: name, password: '1234', emailAddress: name + '@test.com' }))).then(accounts => _.reduce(accounts, (m, acct) => _.set(m, acct.name, acct.accountId), {}))
}

const buildReadModelDebitOrCredit = (accountName, amount, accountMap) => {
  let record = Fixtures.buildDebitOrCredit(accountName, amount)
  record.accountId = accountMap[accountName]
  return record
}

Test('transfers read model', modelTest => {
  modelTest.test('saveTransfer should', saveTransferTest => {
    saveTransferTest.test('save a transfer to the read model', test => {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(savedTransfer => {
              test.ok(savedTransfer)
              test.equal(savedTransfer.transferUuid, transfer.transferUuid)
              test.equal(savedTransfer.state, transfer.state)
              test.end()
            })
        })
    })

    saveTransferTest.end()
  })

  modelTest.test('updateTransfer should', updateTransferTest => {
    updateTransferTest.test('update a transfer in the read model', test => {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      let transferId = Fixtures.generateTransferId()

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          let transfer = Fixtures.buildReadModelTransfer(transferId, buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(() => {
              let updatedFields = { state: TransferState.EXECUTED, fulfillment: 'oAKAAA', executedDate: Moment(1474471284081) }
              return ReadModel.updateTransfer(transferId, updatedFields)
                .then(updatedTransfer => {
                  test.equal(updatedTransfer.transferUuid, transferId)
                  test.equal(updatedTransfer.state, updatedFields.state)
                  test.equal(updatedTransfer.fulfillment, updatedFields.fulfillment)
                  test.deepEqual(updatedTransfer.executedDate, updatedFields.executedDate.toDate())
                  test.end()
                })
            })
        })
    })

    updateTransferTest.end()
  })

  modelTest.test('truncateTransfers should', truncateTest => {
    truncateTest.test('delete all records from transfers table', test => {
      getTransfersCount()
        .then(beforeCount => {
          test.ok(beforeCount > 0)
          ReadModel.truncateTransfers()
            .then(() => {
              getTransfersCount()
                .then(afterCount => {
                  test.equal(afterCount, 0)
                  test.end()
                })
            })
        })
    })

    truncateTest.end()
  })

  modelTest.test('getById should', getByIdTest => {
    getByIdTest.test('retrieve transfer from read model by id and set account fields', test => {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(saved => {
              ReadModel.getById(saved.transferUuid)
                .then(found => {
                  test.notEqual(found, saved)
                  test.notOk(saved.creditAccountName)
                  test.notOk(saved.debitAccountName)
                  test.equal(found.transferUuid, saved.transferUuid)
                  test.equal(found.creditAccountId, accountMap[creditAccountName])
                  test.equal(found.creditAccountName, creditAccountName)
                  test.equal(found.debitAccountId, accountMap[debitAccountName])
                  test.equal(found.debitAccountName, debitAccountName)
                  test.end()
                })
            })
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('retrieve all transfers from read model', test => {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED)
          let transfer2 = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitAccountName, '40', accountMap), buildReadModelDebitOrCredit(creditAccountName, '40', accountMap), TransferState.PREPARED)
          let transfer3 = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitAccountName, '30', accountMap), buildReadModelDebitOrCredit(creditAccountName, '30', accountMap), TransferState.PREPARED)

          ReadModel.truncateTransfers()
            .then(() => ReadModel.saveTransfer(transfer))
            .then(() => ReadModel.saveTransfer(transfer2))
            .then(() => ReadModel.saveTransfer(transfer3))
            .then(() => ReadModel.getAll())
            .then(found => {
              test.ok(found)
              test.equal(3, found.length)
              test.end()
            })
        })
    })

    getAllTest.end()
  })

  modelTest.test('findExpired should', expiredTest => {
    expiredTest.test('retrieve prepared transfers with past expires at', test => {
      let debitAccountName = Fixtures.generateAccountName()
      let creditAccountName = Fixtures.generateAccountName()

      let pastTransferId = Fixtures.generateTransferId()
      let futureTransferId = Fixtures.generateTransferId()

      createAccounts([debitAccountName, creditAccountName])
        .then(accountMap => {
          let pastTransfer = Fixtures.buildReadModelTransfer(pastTransferId, buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED, pastDate())
          let futureTransfer = Fixtures.buildReadModelTransfer(futureTransferId, buildReadModelDebitOrCredit(debitAccountName, '50', accountMap), buildReadModelDebitOrCredit(creditAccountName, '50', accountMap), TransferState.PREPARED)
          ReadModel.saveTransfer(pastTransfer)
            .then(() => ReadModel.saveTransfer(futureTransfer))
            .then(() => {
              ReadModel.findExpired()
                .then(found => {
                  test.equal(found.length, 1)
                  test.equal(found[0].transferUuid, pastTransferId)
                  test.notOk(found[0].debitAccountName)
                  test.notOk(found[0].creditAccountName)
                  test.end()
                })
            })
        })
    })

    expiredTest.end()
  })

  modelTest.end()
})
