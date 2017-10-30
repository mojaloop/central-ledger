'use strict'

const Test = require('tapes')(require('tape'))
const Eventric = require('eventric')
const P = require('bluebird')
const Sinon = require('sinon')
const Moment = require('moment')
const Transfer = require('../../../../src/eventric/transfer')
const TransfersProjection = require('../../../../src/domain/transfer/projection')
const FeesProjection = require('../../../../src/domain/fee/projection')
const SettleableTransfersProjection = require('../../../../src/eventric/transfer/settleable-transfers-projection')
const KnexStore = require('../../../../src/eventric/knex-store')
const CryptoConditions = require('../../../../src/crypto-conditions')
const Errors = require('../../../../src/errors')
const RejectionType = require('../../../../src/domain/transfer/rejection-type')
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

const now = Moment('2016-06-16T00:00:01.000Z')

const createTransfer = () => {
  return {
    id: 'test',
    ledger: 'ledger',
    debits: [{ amount: 10, account: 'test' }],
    credits: [{ amount: 10, account: 'test' }],
    execution_condition: executionCondition,
    expires_at: now.clone().add(1, 'hour').toISOString()
  }
}

const compareTransfers = (assert, transfer1, transfer2) => {
  assert.equal(transfer1.id, transfer2.id)
  assert.equal(transfer1.ledger, transfer2.ledger)
  assert.equal(transfer1.debits, transfer2.debits)
  assert.equal(transfer1.credits, transfer2.credits)
  assert.equal(transfer1.execution_condition, transfer2.execution_condition)
  assert.equal(transfer1.expires_at, transfer2.expires_at)
}

Test('Transfer aggregate', aggregateTest => {
  let sandbox
  let context
  let clock

  aggregateTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(CryptoConditions, 'validateCondition')
    sandbox.stub(CryptoConditions, 'validateFulfillment')
    sandbox.stub(TransfersProjection)
    sandbox.stub(FeesProjection)
    sandbox.stub(SettleableTransfersProjection)
    clock = Sinon.useFakeTimers(now.unix())
    TransfersProjection.initialize.yields()
    FeesProjection.initialize.yields()
    SettleableTransfersProjection.initialize.yields()
    CryptoConditions.validateCondition.returns(true)
    CryptoConditions.validateFulfillment.returns(true)
    context = Eventric.context('TestContext')
    KnexStore.default = {}
    Transfer.setupContext(context)
    context.initialize()
      .then(_t => t.end())
  })

  aggregateTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    context.destroy()
    t.end()
  })

  aggregateTest.test('PrepareTransfer should', createTest => {
    createTest.test('return transfer', t => {
      const transfer = createTransfer()
      P.resolve(context.command('PrepareTransfer', transfer))
        .then(result => {
          t.equal(result.existing, false)
          compareTransfers(t, result.transfer, transfer)
          t.end()
        })
    })

    createTest.test('return existing transfer if preparing again', t => {
      const transfer = createTransfer()
      P.resolve(context.command('PrepareTransfer', transfer))
      .then(prepared => context.command('PrepareTransfer', transfer))
      .then(result => {
        t.equal(result.existing, true)
        compareTransfers(t, result.transfer, transfer)
        t.end()
      })
    })

    createTest.test('reject if transfer does not equal prepared', t => {
      const transfer = createTransfer()
      P.resolve(context.command('PrepareTransfer', transfer))
      .then(prepared => {
        const second = createTransfer()
        second.ledger = 'other'
        return context.command('PrepareTransfer', second)
      })
      .then(() => {
        t.fail('Expected exception')
      })
      .catch(Errors.InvalidModificationError, e => {
        t.end()
      })
      .catch(e => {
        t.fail('Expected InvalidModificationError')
      })
    })

    createTest.end()
  })

  aggregateTest.test('FulfillTransfer should', fulfillTest => {
    fulfillTest.test('load and fulfill transfer', t => {
      const transfer = createTransfer()
      const fulfillment = 'oAKAAA'
      P.resolve(context.command('PrepareTransfer', transfer))
      .then(() => {
        return context.command('FulfillTransfer', { id: transfer.id, fulfillment })
      })
      .then(fulfilledTransfer => {
        compareTransfers(t, fulfilledTransfer, transfer)
        t.equal(fulfilledTransfer.fulfillment, fulfillment)
        t.end()
      })
    })

    fulfillTest.test('return previouslyFulfilled transfer', t => {
      const transfer = createTransfer()
      const fulfillment = 'oAKAAA'
      P.resolve(context.command('PrepareTransfer', transfer))
      .then(prepared => { return context.command('FulfillTransfer', { id: transfer.id, fulfillment }) })
      .then(f => { return context.command('FulfillTransfer', { id: transfer.id, fulfillment }) })
      .then(fulfilledTransfer => {
        compareTransfers(t, fulfilledTransfer, transfer)
        t.equal(fulfilledTransfer.fulfillment, fulfillment)
        t.end()
      })
    })

    fulfillTest.test('throw when fulfilling previously Fulfilled transfer with different condition', t => {
      const transfer = createTransfer()
      const fulfillment = 'cf:0:_v9'
      P.resolve(context.command('PrepareTransfer', transfer))
      .then(prepared => context.command('FulfillTransfer', { id: transfer.id, fulfillment }))
      .then(f => context.command('FulfillTransfer', { id: transfer.id, fulfillment: 'not ' + fulfillment }))
      .then(fulfilledTransfer => {
        t.fail('Expected exception')
      })
      .catch(Errors.InvalidModificationError, e => {
        t.end()
      })
      .catch(e => {
        t.fail('Expected InvalidModificationError: ' + e.message)
      })
    })

    fulfillTest.end()
  })

  aggregateTest.test('RejectTransfer should', rejectTest => {
    rejectTest.test('load and reject transfer', t => {
      const originalTransfer = createTransfer()
      const rejectionReason = RejectionType.CANCELLED

      P.resolve(context.command('PrepareTransfer', originalTransfer))
      .then(prepared => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: rejectionReason }))
      .then(result => {
        const transfer = result.transfer
        compareTransfers(t, transfer, originalTransfer)
        t.equal(transfer.rejection_reason, rejectionReason)
        t.equal(result.alreadyRejected, false)
        t.end()
      })
    })

    rejectTest.test('load and expire transfer', t => {
      const originalTransfer = createTransfer()

      P.resolve(context.command('PrepareTransfer', originalTransfer))
      .then(prepared => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: RejectionType.EXPIRED }))
      .then(result => {
        const transfer = result.transfer
        compareTransfers(t, transfer, originalTransfer)
        t.equal(transfer.rejection_reason, RejectionType.EXPIRED)
        t.equal(result.alreadyRejected, false)
        t.end()
      })
    })

    rejectTest.test('return existing rejected transfer', t => {
      const originalTransfer = createTransfer()
      const rejectionReason = RejectionType.CANCELLED

      P.resolve(context.command('PrepareTransfer', originalTransfer))
      .then(prepared => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: rejectionReason }))
      .then(rejected => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: rejectionReason }))
      .then(result => {
        const transfer = result.transfer
        compareTransfers(t, transfer, originalTransfer)
        t.equal(transfer.rejection_reason, rejectionReason)
        t.equal(result.alreadyRejected, true)
        t.end()
      })
    })

    rejectTest.test('throw InvalidModificationError if rejecting rejected with different reason', t => {
      const originalTransfer = createTransfer()

      P.resolve(context.command('PrepareTransfer', originalTransfer))
      .then(prepared => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: RejectionType.CANCELLED }))
      .then(rejected => context.command('RejectTransfer', { id: originalTransfer.id, rejection_reason: RejectionType.EXPIRED }))
      .then(i => {
        t.fail('Expected exception to be thrown')
      })
      .catch(Errors.InvalidModificationError, e => {
        t.pass()
      })
      .catch(e => {
        t.fail(e)
      })
      .then(t.end)
    })

    rejectTest.end()
  })

  aggregateTest.end()
})
