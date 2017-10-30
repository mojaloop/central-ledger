'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const P = require('bluebird')
const Commands = require(`${src}/eventric/transfer/commands`)
const Validator = require(`${src}/eventric/transfer/validator`)
const NotFoundError = require('../../../../src/errors').NotFoundError

const noAggregateFound = (id) => P.reject(new Error(`No domainEvents for aggregate of type Transfer with ${id} available`))

const assertNotFound = (t, promise) => {
  promise
  .then(result => {
    t.fail('Expected exception')
    t.end()
  })
  .catch(NotFoundError, e => {
    t.pass()
    t.end()
  })
  .catch(e => {
    t.fail('Wrong exception thrown')
    t.end()
  })
}

Test('Commands Test', commandsTest => {
  let sandbox

  commandsTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Validator, 'validateExistingOnPrepare')
    sandbox.stub(Validator, 'validateReject')
    sandbox.stub(Validator, 'validateFulfillment')
    sandbox.stub(Validator, 'validateSettle')
    Commands.$aggregate = sandbox.stub()
    Commands.$aggregate.load = sandbox.stub()
    Commands.$aggregate.create = sandbox.stub()
    t.end()
  })

  commandsTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  commandsTest.test('Prepare should', prepareTest => {
    prepareTest.test('return existing transfer', t => {
      const id = Uuid()
      const transfer = {}

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))
      Validator.validateExistingOnPrepare.returns(P.resolve(transfer))
      Commands.PrepareTransfer({ id: id })
      .then(result => {
        t.equal(result.existing, true)
        t.equal(result.transfer, transfer)
        t.end()
      })
    })

    prepareTest.test('return reject if error thrown on load', t => {
      const id = Uuid()
      const error = new Error('Some error')

      Commands.$aggregate.load.returns(P.reject(error))

      Commands.PrepareTransfer({ id: id })
      .then(() => {
        t.fail('Expected exception')
        t.end()
      })
      .catch(e => {
        t.equal(e, error)
        t.end()
      })
    })

    prepareTest.test('create new transfer if matching one does not exist', t => {
      const id = Uuid()
      const transfer = {
        $save: () => P.resolve()
      }
      Commands.$aggregate.load.withArgs('Transfer', id).returns(noAggregateFound(id))
      Commands.$aggregate.create.returns(P.resolve(transfer))

      Commands.PrepareTransfer({ id: id })
      .then(result => {
        t.equal(result.existing, false)
        t.equal(result.transfer, transfer)
        t.end()
      })
    })

    prepareTest.end()
  })

  commandsTest.test('Fulfill should', fulfillTest => {
    fulfillTest.test('return NotFoundError if aggregate not found', t => {
      const id = Uuid()
      const fulfillment = 'test'

      Commands.$aggregate.load.withArgs('Transfer', id).returns(noAggregateFound(id))
      assertNotFound(t, Commands.FulfillTransfer({ id: id, fulfillment: fulfillment }))
    })

    fulfillTest.test('return error if Validator rejects', t => {
      const id = Uuid()
      const fulfillmentCondition = 'test'
      const transfer = {}
      const error = new Error()

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))
      Validator.validateFulfillment.returns(P.reject(error))

      Commands.FulfillTransfer({ id: id, fulfillment: fulfillmentCondition })
      .then(() => {
        t.fail('Expected error to be thrown')
        t.end()
      })
      .catch(e => {
        t.equal(e, error)
        t.end()
      })
    })

    fulfillTest.end()
  })

  commandsTest.test('Reject should', rejectTest => {
    rejectTest.test('return NotFoundError id transfer not found', t => {
      const id = Uuid()
      const rejectionReason = 'test'
      Commands.$aggregate.load.withArgs('Transfer', id).returns(noAggregateFound(id))
      assertNotFound(t, Commands.RejectTransfer({ id: id, rejection_reason: rejectionReason }))
    })

    rejectTest.test('return error if Validator rejects', t => {
      const id = Uuid()
      const transfer = {}
      Commands.$aggregate.load.withArgs('Transfer', id).returns(transfer)
      const error = new Error('Validation failed')
      Validator.validateReject.returns(P.reject(error))

      Commands.RejectTransfer({ id: id, rejection_reason: 'reason' })
      .then(() => {
        t.fail('Expected exception')
        t.end()
      })
      .catch(e => {
        t.deepEqual(e, error)
        t.end()
      })
    })

    rejectTest.test('return rejection reason if already rejected', t => {
      const id = Uuid()
      const transfer = {}
      const rejectionReason = 'here we go again'
      Validator.validateReject.withArgs(transfer).returns(P.resolve({ alreadyRejected: true }))

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))

      Commands.RejectTransfer({ id: id, rejection_reason: rejectionReason })
      .then(result => {
        t.equal(result.transfer, transfer)
        t.equal(result.alreadyRejected, true)
        t.end()
      })
    })

    rejectTest.test('reject and save transfer if not already rejected', t => {
      const id = Uuid()
      const transfer = {}
      const rejectionReason = 'cancelled'
      const message = 'here we go again'
      const requestingAccount = { name: 'dfps1' }
      const rejectStub = sandbox.stub()
      const saveStub = sandbox.stub()
      saveStub.returns(P.resolve())

      transfer.$save = saveStub
      transfer.reject = rejectStub

      Validator.validateReject.withArgs(transfer, rejectionReason, requestingAccount).returns(P.resolve({ alreadyRejected: false }))

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))

      Commands.RejectTransfer({ id, message, requestingAccount, rejection_reason: rejectionReason })
      .then(transfer => {
        t.equal(transfer, transfer)
        t.ok(rejectStub.calledWith(Sinon.match({ rejection_reason: rejectionReason, message: message })))
        t.ok(saveStub.calledOnce)
        t.end()
      })
    })

    rejectTest.end()
  })

  commandsTest.test('Settle should', settleTest => {
    settleTest.test('return NotFoundError if aggregate not found', t => {
      const id = Uuid()
      const settlementId = Uuid()

      Commands.$aggregate.load.withArgs('Transfer', id).returns(noAggregateFound(id))
      assertNotFound(t, Commands.SettleTransfer({ id: id, settlement_id: settlementId }))
    })

    settleTest.test('return error if Validator rejects', t => {
      const id = Uuid()
      const settlementId = Uuid()
      const transfer = {}
      const error = new Error()

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))
      Validator.validateSettle.returns(P.reject(error))

      Commands.SettleTransfer({ id: id, settlement_id: settlementId })
      .then(() => {
        t.fail('Expected error to be thrown')
        t.end()
      })
      .catch(e => {
        t.equal(e, error)
        t.end()
      })
    })

    settleTest.test('settle and save transfer if not already settled', t => {
      const id = Uuid()
      const settlementId = Uuid()
      const transfer = {}
      const settleStub = sandbox.stub()
      const saveStub = sandbox.stub()
      saveStub.returns(P.resolve())

      transfer.$save = saveStub
      transfer.settle = settleStub

      Validator.validateSettle.withArgs(transfer).returns(P.resolve())

      Commands.$aggregate.load.withArgs('Transfer', id).returns(P.resolve(transfer))

      Commands.SettleTransfer({ id: id, settlement_id: settlementId })
      .then(result => {
        t.equal(result, transfer)
        t.ok(settleStub.calledWith(Sinon.match({ settlement_id: settlementId })))
        t.ok(saveStub.calledOnce)
        t.end()
      })
    })

    settleTest.end()
  })

  commandsTest.end()
})
