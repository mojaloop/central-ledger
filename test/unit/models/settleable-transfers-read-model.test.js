'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/models/settleable-transfers-read-model`)
const Db = require(`${src}/db`)

Test('settleable-transfers-read-model', function (modelTest) {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.executedTransfers = {
      query: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('getSettleableTransfers should', getSettleableTransfersTest => {
    getSettleableTransfersTest.test('return settleable transfers', test => {
      let settleableTransfers = [{ transferId: 1, creditAccountName: 'dfsp1', debitAccountName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

      let builderStub = sandbox.stub()
      let joinTransfersStub = sandbox.stub()
      let joinCreditStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let joinAccountSettlementSourceStub = sandbox.stub()
      let joinAccountSettlementDestinationStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.executedTransfers.query.callsArgWith(0, builderStub)
      Db.executedTransfers.query.returns(P.resolve(settleableTransfers))

      builderStub.leftJoin.returns({
        innerJoin: joinTransfersStub.returns({
          innerJoin: joinCreditStub.returns({
            innerJoin: joinDebitStub.returns({
              innerJoin: joinAccountSettlementSourceStub.returns({
                innerJoin: joinAccountSettlementDestinationStub.returns({
                  whereNull: whereNullStub.returns({
                    distinct: distinctStub
                  })
                })
              })
            })
          })
        })
      })

      Model.getSettleableTransfers()
        .then(found => {
          test.equal(found, settleableTransfers)
          test.ok(builderStub.leftJoin.withArgs('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId').calledOnce)
          test.ok(joinTransfersStub.withArgs('transfers AS t', 'executedTransfers.transferId', 't.transferId').calledOnce)
          test.ok(joinCreditStub.withArgs('accounts AS ca', 't.payerParticipantId', 'ca.accountId').calledOnce)
          test.ok(joinDebitStub.withArgs('accounts AS da', 't.payeeParticipantId', 'da.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.end()
        })
    })

    getSettleableTransfersTest.end()
  })

  modelTest.test('getUnsettledTransfers should', getUnsettledTransfersTest => {
    getUnsettledTransfersTest.test('return settleable transfers', test => {
      let settleableTransfers = [{ transferId: 1, creditAccountName: 'dfsp1', debitAccountName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

      let builderStub = sandbox.stub()
      let joinTransfersStub = sandbox.stub()
      let joinCreditStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.executedTransfers.query.callsArgWith(0, builderStub)
      Db.executedTransfers.query.returns(P.resolve(settleableTransfers))

      builderStub.leftJoin.returns({
        innerJoin: joinTransfersStub.returns({
          innerJoin: joinCreditStub.returns({
            innerJoin: joinDebitStub.returns({
              whereNull: whereNullStub.returns({
                distinct: distinctStub
              })
            })
          })
        })
      })

      Model.getUnsettledTransfers()
        .then(found => {
          test.equal(found, settleableTransfers)
          test.ok(builderStub.leftJoin.withArgs('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId').calledOnce)
          test.ok(joinTransfersStub.withArgs('transfers AS t', 'executedTransfers.transferId', 't.transferId').calledOnce)
          test.ok(joinCreditStub.withArgs('accounts AS ca', 't.payerParticipantId', 'ca.accountId').calledOnce)
          test.ok(joinDebitStub.withArgs('accounts AS da', 't.payeeParticipantId', 'da.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledTransfersTest.end()
  })

  modelTest.test('getUnsettledTransfersByAccount should', getUnsettledTransfersByAccountTest => {
    getUnsettledTransfersByAccountTest.test('return settleable transfers by account', test => {
      let accountId = 1
      let settleableTransfers = [{ transferId: 1, creditAccountName: 'dfsp1', debitAccountName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

      let builderStub = sandbox.stub()
      let joinTransfersStub = sandbox.stub()
      let joinCreditStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()
      let andWhereStub = sandbox.stub()

      let groupStub = sandbox.stub()
      let groupWhereStub = sandbox.stub()
      let groupOrWhereStub = sandbox.stub()

      groupStub.where = groupWhereStub.returns({ orWhere: groupOrWhereStub })
      andWhereStub.callsArgWith(0, groupStub)

      builderStub.leftJoin = sandbox.stub()

      Db.executedTransfers.query.callsArgWith(0, builderStub)
      Db.executedTransfers.query.returns(P.resolve(settleableTransfers))

      builderStub.leftJoin.returns({
        innerJoin: joinTransfersStub.returns({
          innerJoin: joinCreditStub.returns({
            innerJoin: joinDebitStub.returns({
              whereNull: whereNullStub.returns({
                distinct: distinctStub.returns({
                  andWhere: andWhereStub
                })
              })
            })
          })
        })
      })

      Model.getUnsettledTransfersByAccount(accountId)
        .then(found => {
          test.equal(found, settleableTransfers)
          test.ok(builderStub.leftJoin.withArgs('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId').calledOnce)
          test.ok(joinTransfersStub.withArgs('transfers AS t', 'executedTransfers.transferId', 't.transferId').calledOnce)
          test.ok(joinCreditStub.withArgs('accounts AS ca', 't.payerParticipantId', 'ca.accountId').calledOnce)
          test.ok(joinDebitStub.withArgs('accounts AS da', 't.payeeParticipantId', 'da.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditAccountName', 'da.name AS debitAccountName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.ok(groupWhereStub.withArgs('t.payerParticipantId', accountId).calledOnce)
          test.ok(groupOrWhereStub.withArgs('t.payeeParticipantId', accountId).calledOnce)
          test.end()
        })
    })

    getUnsettledTransfersByAccountTest.end()
  })

  modelTest.end()
})
