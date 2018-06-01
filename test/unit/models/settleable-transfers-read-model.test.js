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
      let settleableTransfers = [{ transferId: 1, creditParticipantName: 'dfsp1', debitParticipantName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

      let builderStub = sandbox.stub()
      let joinTransfersStub = sandbox.stub()
      let joinCreditStub = sandbox.stub()
      let joinDebitStub = sandbox.stub()
      let joinParticipantSettlementSourceStub = sandbox.stub()
      let joinParticipantSettlementDestinationStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.executedTransfers.query.callsArgWith(0, builderStub)
      Db.executedTransfers.query.returns(P.resolve(settleableTransfers))

      builderStub.leftJoin.returns({
        innerJoin: joinTransfersStub.returns({
          innerJoin: joinCreditStub.returns({
            innerJoin: joinDebitStub.returns({
              innerJoin: joinParticipantSettlementSourceStub.returns({
                innerJoin: joinParticipantSettlementDestinationStub.returns({
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
          test.ok(joinCreditStub.withArgs('participant AS ca', 't.payerParticipantId', 'ca.participantId').calledOnce)
          test.ok(joinDebitStub.withArgs('participant AS da', 't.payeeParticipantId', 'da.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditParticipantName', 'da.name AS debitParticipantName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.end()
        })
    })

    getSettleableTransfersTest.end()
  })

  modelTest.test('getUnsettledTransfers should', getUnsettledTransfersTest => {
    getUnsettledTransfersTest.test('return settleable transfers', test => {
      let settleableTransfers = [{ transferId: 1, creditParticipantName: 'dfsp1', debitParticipantName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

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
          test.ok(joinCreditStub.withArgs('participant AS ca', 't.payerParticipantId', 'ca.participantId').calledOnce)
          test.ok(joinDebitStub.withArgs('participant AS da', 't.payeeParticipantId', 'da.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditParticipantName', 'da.name AS debitParticipantName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledTransfersTest.end()
  })

  modelTest.test('getUnsettledTransfersByParticipant should', getUnsettledTransfersByParticipantTest => {
    getUnsettledTransfersByParticipantTest.test('return settleable transfers by participant', test => {
      let participantId = 1
      let settleableTransfers = [{ transferId: 1, creditParticipantName: 'dfsp1', debitParticipantName: 'dfsp2', payerAmount: 1.00, payeeAmount: 1.00 }]

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

      Model.getUnsettledTransfersByParticipant(participantId)
        .then(found => {
          test.equal(found, settleableTransfers)
          test.ok(builderStub.leftJoin.withArgs('settledTransfers AS st', 'executedTransfers.transferId', 'st.transferId').calledOnce)
          test.ok(joinTransfersStub.withArgs('transfers AS t', 'executedTransfers.transferId', 't.transferId').calledOnce)
          test.ok(joinCreditStub.withArgs('participant AS ca', 't.payerParticipantId', 'ca.participantId').calledOnce)
          test.ok(joinDebitStub.withArgs('participant AS da', 't.payeeParticipantId', 'da.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('st.transferId').calledOnce)
          test.ok(distinctStub.withArgs('executedTransfers.transferId AS transferId', 'ca.name AS creditParticipantName', 'da.name AS debitParticipantName', 't.payerAmount AS payerAmount', 't.payeeAmount AS payeeAmount').calledOnce)
          test.ok(groupWhereStub.withArgs('t.payerParticipantId', participantId).calledOnce)
          test.ok(groupOrWhereStub.withArgs('t.payeeParticipantId', participantId).calledOnce)
          test.end()
        })
    })

    getUnsettledTransfersByParticipantTest.end()
  })

  modelTest.end()
})
