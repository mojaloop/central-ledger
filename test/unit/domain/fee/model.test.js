'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Model = require(`${src}/domain/fee/model`)
const Db = require(`${src}/db`)

Test('fees model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.fees = {
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

      Db.fees.find.returns(P.reject(error))

      Model.getAllForTransfer({ transferUuid: '1234' })
        .then(() => {
          test.fail('Should have thrown error')
        })
        .catch(err => {
          test.equal(err, error)
          test.end()
        })
    })

    getAllForTransferTest.test('return all fees ordered by feeId', test => {
      const feeId1 = '1'
      const feeId2 = '2'
      const fees = [{ feeId: feeId1 }, { feeId: feeId2 }]
      const transfer = { transferUuid: '1234' }

      Db.fees.find.returns(P.resolve(fees))

      Model.getAllForTransfer(transfer)
        .then((found) => {
          test.equal(found, fees)
          test.ok(Db.fees.find.calledWith({ transferId: transfer.transferUuid }))
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
        payerAccountId: 1,
        payeeAccountId: 2,
        chargeId: 3
      }

      const payload = {
        transferId: transferId,
        amount: amount,
        payerAccountId: 1,
        payeeAccountId: 2,
        chargeId: 3
      }

      Db.fees.insert.returns(P.resolve(fee))

      Model.create(payload)
        .then(c => {
          test.equal(c, fee)
          test.ok(Db.fees.insert.calledWith(payload))
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
      const transfer = { transferUuid: transferId }

      Db.fees.findOne.returns(P.resolve(fee))

      Model.doesExist(charge, transfer)
        .then(existing => {
          test.equal(existing, fee)
          test.ok(Db.fees.findOne.calledWith({ transferId: transfer.transferUuid, chargeId: charge.chargeId }))
          test.end()
        })
    })

    doesExist.end()
  })

  modelTest.test('getUnsettledFeesByAccount should', getUnsettledFeesByAccountTest => {
    getUnsettledFeesByAccountTest.test('return settleable fees for account', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fees = [{ transferId, amount, chargeId }]

      const account = { accountId: 11 }

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

      Db.fees.query.callsArgWith(0, builderStub)
      Db.fees.query.returns(P.resolve(fees))

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

      Model.getUnsettledFeesByAccount(account)
        .then(foundFee => {
          test.equal(foundFee, fees)
          test.ok(builderStub.leftJoin.withArgs('settledFees AS sf', 'fees.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('accounts AS pr', 'fees.payerAccountId', 'pr.accountId').calledOnce)
          test.ok(joinPayeeStub.withArgs('accounts AS pe', 'fees.payeeAccountId', 'pe.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledFeesByAccountTest.end()
  })

  modelTest.test('getSettleableFeesForTransfer should', getSettleableFeesForTransferTest => {
    getSettleableFeesForTransferTest.test('return settleable fees for account', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fees = [{ transferId, amount, chargeId }]

      Db.fees.find.returns(P.resolve(fees))

      let builderStub = sandbox.stub()
      let joinPayerStub = sandbox.stub()
      let joinPayeeStub = sandbox.stub()
      let joinAccountSettlementSourceStub = sandbox.stub()
      let joinAccountSettlemenetDestinationStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()
      let whereStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.fees.query.callsArgWith(0, builderStub)
      Db.fees.query.returns(P.resolve(fees))

      builderStub.leftJoin.returns({
        innerJoin: joinPayeeStub.returns({
          innerJoin: joinPayerStub.returns({
            innerJoin: joinAccountSettlementSourceStub.returns({
              innerJoin: joinAccountSettlemenetDestinationStub.returns({
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

      Model.getSettleableFeesForTransfer(transferId)
        .then(foundFee => {
          test.equal(foundFee, fees)
          test.ok(builderStub.leftJoin.withArgs('settledFees AS sf', 'fees.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('accounts AS pr', 'fees.payerAccountId', 'pr.accountId').calledOnce)
          test.ok(joinPayeeStub.withArgs('accounts AS pe', 'fees.payeeAccountId', 'pe.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getSettleableFeesForTransferTest.end()
  })

  modelTest.test('getUnsettledFees should', getUnsettledFeesTest => {
    getUnsettledFeesTest.test('return settleable fees', test => {
      const transferId = '1'
      const chargeId = '1'
      const amount = '1.00'
      const fees = [{ transferId, amount, chargeId }]

      let builderStub = sandbox.stub()
      let joinPayerStub = sandbox.stub()
      let joinPayeeStub = sandbox.stub()
      let whereNullStub = sandbox.stub()
      let distinctStub = sandbox.stub()

      builderStub.leftJoin = sandbox.stub()

      Db.fees.query.callsArgWith(0, builderStub)
      Db.fees.query.returns(P.resolve(fees))

      builderStub.leftJoin.returns({
        innerJoin: joinPayeeStub.returns({
          innerJoin: joinPayerStub.returns({
            whereNull: whereNullStub.returns({
              distinct: distinctStub
            })
          })
        })
      })

      Model.getUnsettledFees()
        .then(foundFee => {
          test.equal(foundFee, fees)
          test.ok(builderStub.leftJoin.withArgs('settledFees AS sf', 'fees.feeId', 'sf.feeId').calledOnce)
          test.ok(joinPayerStub.withArgs('accounts AS pr', 'fees.payerAccountId', 'pr.accountId').calledOnce)
          test.ok(joinPayeeStub.withArgs('accounts AS pe', 'fees.payeeAccountId', 'pe.accountId').calledOnce)
          test.ok(whereNullStub.withArgs('sf.feeId').calledOnce)
          test.ok(distinctStub.withArgs('fees.feeId AS feeId', 'pe.name AS payeeAccountName', 'pr.name AS payerAccountName', 'fees.amount AS payeeAmount', 'fees.amount AS payerAmount').calledOnce)
          test.end()
        })
    })

    getUnsettledFeesTest.end()
  })

  modelTest.end()
})
