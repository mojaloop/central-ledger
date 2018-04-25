'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/domain/fee/model`)
const Db = require(`${src}/db`)

Test('fee model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.fee = {
      insert: sandbox.stub(),
      find: sandbox.stub(),
      findOne: sandbox.stub(),
      query: sandbox.stub()
    }

    Db.executedTransfers = {
      query: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('getAllForTransfer should', getAllForTransferTest => {
    getAllForTransferTest.test('return exception if db query throws', test => {
      const error = new Error()

      Db.fee.find.returns(P.reject(error))

      Model.getAllForTransfer({ transferId: '1234' })
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getAllForTransferTest.test('return all fee ordered by feeId', test => {
      const feeId1 = '1'
      const feeId2 = '2'
      const fee = [{ feeId: feeId1 }, { feeId: feeId2 }]
      const transfer = { transferId: '1234' }

      Db.fee.find.returns(P.resolve(fee))

      Model.getAllForTransfer(transfer)
        .then((found) => {
          test.equal(found, fee)
          test.ok(Db.fee.find.calledWith({ transferId: transfer.transferId }))
          test.end()
        })
    })

    getAllForTransferTest.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return newly created fee', test => {
      const transferId = '1'
      const amount = '1.00'

      const fee = {
        transferId: transferId,
        amount: amount,
        payerParticipantId: 1,
        payeeParticipantId: 2,
        chargeId: 3
      }

      const payload = {
        transferId: transferId,
        amount: amount,
        payerParticipantId: 1,
        payeeParticipantId: 2,
        chargeId: 3
      }

      Db.fee.insert.returns(P.resolve(fee))

      Model.create(payload)
        .then(c => {
          test.equal(c, fee)
          test.ok(Db.fee.insert.calledWith(payload))
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('doesExist should', doesExist => {
    doesExist.test('return fee if it already exists', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fee = { transferId, amount, chargeId }

      const charge = { chargeId }
      const transfer = { transferId: transferId }

      Db.fee.findOne.returns(P.resolve(fee))

      Model.doesExist(charge, transfer)
        .then(existing => {
          test.equal(existing, fee)
          test.ok(Db.fee.findOne.calledWith({ transferId: transfer.transferId, chargeId: charge.chargeId }))
          test.end()
        })
    })

    doesExist.end()
  })

  modelTest.test('getUnsettledFeeByParticipant should', getUnsettledFeeByParticipantTest => {
    getUnsettledFeeByParticipantTest.test('return settleable fee for participant', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fee = [{ transferId, amount, chargeId }]

      const participant = { participantId: 11 }

      let builderStub = sandbox.stub()
      let joinPayerStub = sandbox.stub()
      let joinPayeeStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()
      let andWhereStub = sandbox.stub()

      let groupStub = sandbox.stub()
      let groupWhereStub = sandbox.stub()
      let groupOrWhereStub = sandbox.stub()

      groupStub.where = groupWhereStub.returns({ orWhere: groupOrWhereStub })
      andWhereStub.callsArgWith(0, groupStub)

      builderStub.leftJoin = sandbox.stub()

      Db.fee.query.callsArgWith(0, builderStub)
      Db.fee.query.returns(P.resolve(fee))

      builderStub.leftJoin.returns({
        innerJoin: joinPayeeStub.returns({
          innerJoin: joinPayerStub.returns({
            whereNull: whereNullStub.returns({
              distinct: distinctStub.returns({
                andWhere: andWhereStub
              })
            })
          })
        })
      })

      Model.getUnsettledFeeByParticipant(participant)
        .then(foundFee => {
          test.equal(foundFee, fee)
          test.ok(builderStub.leftJoin.withArgs('settledFee AS sf', 'fee.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('participant AS pr', 'fee.payerParticipantId', 'pr.participantId').calledOnce)
          test.ok(joinPayeeStub.withArgs('participant AS pe', 'fee.payeeParticipantId', 'pe.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fee.feeId AS feeId', 'pe.name AS payeeParticipantName', 'pr.name AS payerParticipantName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledFeeByParticipantTest.end()
  })

  modelTest.test('getSettleableFeeForTransfer should', getSettleableFeeForTransferTest => {
    getSettleableFeeForTransferTest.test('return settleable fee for participant', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fee = [{ transferId, amount, chargeId }]

      Db.fee.find.returns(P.resolve(fee))

      let builderStub = sandbox.stub()
      let joinPayerStub = sandbox.stub()
      let joinPayeeStub = sandbox.stub()
      let joinParticipantSettlementSourceStub = sandbox.stub()
      let joinParticipantSettlemenetDestinationStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()
      let whereStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.fee.query.callsArgWith(0, builderStub)
      Db.fee.query.returns(P.resolve(fee))

      builderStub.leftJoin.returns({
        innerJoin: joinPayeeStub.returns({
          innerJoin: joinPayerStub.returns({
            innerJoin: joinParticipantSettlementSourceStub.returns({
              innerJoin: joinParticipantSettlemenetDestinationStub.returns({
                whereNull: whereNullStub.returns({
                  distinct: distinctStub.returns({
                    where: whereStub
                  })
                })
              })
            })
          })
        })
      })

      Model.getSettleableFeeForTransfer(transferId)
        .then(foundFee => {
          test.equal(foundFee, fee)
          test.ok(builderStub.leftJoin.withArgs('settledFee AS sf', 'fee.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('participant AS pr', 'fee.payerParticipantId', 'pr.participantId').calledOnce)
          test.ok(joinPayeeStub.withArgs('participant AS pe', 'fee.payeeParticipantId', 'pe.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fee.feeId AS feeId', 'pe.name AS payeeParticipantName', 'pr.name AS payerParticipantName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getSettleableFeeForTransferTest.end()
  })

  modelTest.test('getUnsettledFee should', getUnsettledFeeTest => {
    getUnsettledFeeTest.test('return settleable fee', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fee = [{ transferId, amount, chargeId }]

      let builderStub = sandbox.stub()
      let joinPayerStub = sandbox.stub()
      let joinPayeeStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.fee.query.callsArgWith(0, builderStub)
      Db.fee.query.returns(P.resolve(fee))

      builderStub.leftJoin.returns({
        innerJoin: joinPayeeStub.returns({
          innerJoin: joinPayerStub.returns({
            whereNull: whereNullStub.returns({
              distinct: distinctStub
            })
          })
        })
      })

      Model.getUnsettledFee()
        .then(foundFee => {
          test.equal(foundFee, fee)
          test.ok(builderStub.leftJoin.withArgs('settledFee AS sf', 'fee.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('participant AS pr', 'fee.payerParticipantId', 'pr.participantId').calledOnce)
          test.ok(joinPayeeStub.withArgs('participant AS pe', 'fee.payeeParticipantId', 'pe.participantId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fee.feeId AS feeId', 'pe.name AS payeeParticipantName', 'pr.name AS payerParticipantName', 'fee.amount AS payeeAmount', 'fee.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledFeeTest.end()
  })

  modelTest.end()
})
