'use strict'

const src = '../../../../../src'
const _ = require('lodash')
const P = require('bluebird')
const Test = require('tape')
const Moment = require('moment')
const Db = require(`${src}/db`)
const Participant = require(`${src}/domain/participant`)
const ReadModel = require(`${src}/domain/transfer/models/transfers-read-model`)
const Fixtures = require('../../../../fixtures')
const TransferState = require('../../../../../src/domain/transfer/state')

let pastDate = () => {
  let d = new Date()
  d.setDate(d.getDate() - 5)
  return d
}

const getTransfersCount = () => {
  return Db.transfer.count({}, '*')
}

const createParticipants = (participantNames) => {
  return P.all(participantNames.map(name => Participant.create({ name: name, password: '1234', emailAddress: name + '@test.com' }))).then(participant => _.reduce(participant, (m, acct) => _.set(m, acct.name, acct.participantId), {}))
}

const buildReadModelDebitOrCredit = (participantName, amount, participantMap) => {
  let record = Fixtures.buildDebitOrCredit(participantName, amount)
  record.participantId = participantMap[participantName]
  return record
}

Test('transfers read model', modelTest => {
  modelTest.test('saveTransfer should', saveTransferTest => {
    saveTransferTest.test('save a transfer to the read model', test => {
      let debitParticipantName = Fixtures.generateParticipantName()
      let creditParticipantName = Fixtures.generateParticipantName()

      createParticipants([debitParticipantName, creditParticipantName])
        .then(participantMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(savedTransfer => {
              test.ok(savedTransfer)
              test.equal(savedTransfer.transferId, transfer.transferId)
           //   test.equal(savedTransfer.state, transfer.state)
              test.end()
            })
        })
    })

    saveTransferTest.end()
  })

  modelTest.test('updateTransfer should', updateTransferTest => {
    updateTransferTest.test('update a transfer in the read model', test => {
      let debitParticipantName = Fixtures.generateParticipantName()
      let creditParticipantName = Fixtures.generateParticipantName()

      let transferId = Fixtures.generateTransferId()

      createParticipants([debitParticipantName, creditParticipantName])
        .then(participantMap => {
          let transfer = Fixtures.buildReadModelTransfer(transferId, buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(() => {
              let updatedFields = { state: TransferState.EXECUTED, fulfilment: 'oAKAAA', executedDate: Moment(1474471284081) }
              return ReadModel.updateTransfer(transferId, updatedFields)
                .then(updatedTransfer => {
                  test.equal(updatedTransfer.transferId, transferId)
                  // test.equal(updatedTransfer.state, updatedFields.state)
                  test.equal(updatedTransfer.fulfilment, updatedFields.fulfilment)
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
    getByIdTest.test('retrieve transfer from read model by id and set participant fields', test => {
      let debitParticipantName = Fixtures.generateParticipantName()
      let creditParticipantName = Fixtures.generateParticipantName()

      createParticipants([debitParticipantName, creditParticipantName])
        .then(participantMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED)
          ReadModel.saveTransfer(transfer)
            .then(saved => {
              ReadModel.getById(saved.transferId)
                .then(found => {
                  test.notEqual(found, saved)
                  test.notOk(saved.creditParticipantName)
                  test.notOk(saved.debitParticipantName)
                  test.equal(found.transferId, saved.transferId)
                  test.equal(found.payerParticipantId, participantMap[creditParticipantName])
                  test.equal(found.creditParticipantName, creditParticipantName)
                  test.equal(found.payeeParticipantId, participantMap[debitParticipantName])
                  test.equal(found.debitParticipantName, debitParticipantName)
                  test.end()
                })
            })
        })
    })

    getByIdTest.end()
  })

  modelTest.test('getAll should', getAllTest => {
    getAllTest.test('retrieve all transfers from read model', test => {
      let debitParticipantName = Fixtures.generateParticipantName()
      let creditParticipantName = Fixtures.generateParticipantName()

      createParticipants([debitParticipantName, creditParticipantName])
        .then(participantMap => {
          let transfer = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED)
          let transfer2 = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitParticipantName, '40', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '40', participantMap), TransferState.PREPARED)
          let transfer3 = Fixtures.buildReadModelTransfer(Fixtures.generateTransferId(), buildReadModelDebitOrCredit(debitParticipantName, '30', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '30', participantMap), TransferState.PREPARED)

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
      let debitParticipantName = Fixtures.generateParticipantName()
      let creditParticipantName = Fixtures.generateParticipantName()

      let pastTransferId = Fixtures.generateTransferId()
      let futureTransferId = Fixtures.generateTransferId()

      createParticipants([debitParticipantName, creditParticipantName])
        .then(participantMap => {
          let pastTransfer = Fixtures.buildReadModelTransfer(pastTransferId, buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED, pastDate())
          let futureTransfer = Fixtures.buildReadModelTransfer(futureTransferId, buildReadModelDebitOrCredit(debitParticipantName, '50', participantMap), buildReadModelDebitOrCredit(creditParticipantName, '50', participantMap), TransferState.PREPARED)
          ReadModel.saveTransfer(pastTransfer)
            .then(() => ReadModel.saveTransfer(futureTransfer))
            .then(() => {
              ReadModel.findExpired()
                .then(found => {
                  test.equal(found.length, 1)
                  test.equal(found[0].transferId, pastTransferId)
                  test.notOk(found[0].debitParticipantName)
                  test.notOk(found[0].creditParticipantName)
                  test.end()
                })
            })
        })
    })

    expiredTest.end()
  })

  modelTest.end()
})
