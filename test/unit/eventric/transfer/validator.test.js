'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Moment = require('moment')
const _ = require('lodash')
const Validator = require(`${src}/eventric/transfer/validator`)
const TransferState = require(`${src}/domain/transfer/state`)
const Errors = require('../../../../src/errors')
const CryptoConditions = require(`${src}/crypto-conditions`)
const UrlParser = require('../../../../src/lib/urlparser')
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'

Test('validator tests', validatorTest => {
  let sandbox
  let clock
  const now = Moment('2016-06-16T00:00:01.000Z')

  validatorTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(CryptoConditions, 'validateFulfillment')
    clock = Sinon.useFakeTimers(now.unix())
    t.end()
  })

  validatorTest.afterEach(t => {
    sandbox.restore()
    clock.restore()
    t.end()
  })

  validatorTest.test('validateFulfillment should', fulfillmentTest => {
    fulfillmentTest.test('throw TransferNotConditionalError if transfer does not have execution_condition', test => {
      const transfer = {
        state: TransferState.EXECUTED,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, 'test-fulfillment')
        .then(() => {
          test.fail('Expected exception')
        })
        .catch(Errors.TransferNotConditionalError, e => {
          test.ok(e instanceof Errors.TransferNotConditionalError)
          test.equal(e.message, 'Transfer is not conditional')
        }).then(test.end)
    })

    fulfillmentTest.test('return previouslyFulfilled if transfer is Executed and fulfillment is the same', t => {
      const fulfillment = 'test-fulfillment'
      const transfer = {
        state: TransferState.EXECUTED,
        execution_condition: executionCondition,
        fulfillment,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, fulfillment)
      .then(result => {
        t.equal(result.previouslyFulfilled, true)
        t.end()
      })
    })

    fulfillmentTest.test('return previouslyFulfilled if transfer is Settled and fulfillment is the same', t => {
      const fulfillment = 'test-fulfillment'
      const transfer = {
        state: TransferState.SETTLED,
        execution_condition: executionCondition,
        fulfillment,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, fulfillment)
      .then(result => {
        t.equal(result.previouslyFulfilled, true)
        t.end()
      })
    })

    fulfillmentTest.test('throw InvalidModificationError if transfer is not prepared', t => {
      const transfer = {
        state: TransferState.REJECTED,
        execution_condition: executionCondition,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, 'test-fulfillment')
      .then(() => {
        t.fail('Expected exception')
      })
      .catch(Errors.InvalidModificationError, e => {
        t.equal(e.message, 'Transfers in state rejected may not be executed')
      })
      .catch(e => {
        t.fail('Expected InvalidModificationError')
      })
      .then(t.end)
    })

    fulfillmentTest.test('throw error if validateFulfillmentCondition throw', t => {
      const error = new Error()
      const fulfillment = 'fulfillment'
      CryptoConditions.validateFulfillment.withArgs(fulfillment, executionCondition).throws(error)
      const transfer = {
        state: TransferState.PREPARED,
        execution_condition: executionCondition,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, fulfillment)
      .then(() => {
        t.fail('Expected exception')
      })
      .catch(e => {
        t.equal(e, error)
      })
      .then(t.end)
    })

    fulfillmentTest.test('return not previouslyFulfilled if transfer passes all checks', t => {
      CryptoConditions.validateFulfillment.returns(true)
      const transfer = {
        state: TransferState.PREPARED,
        execution_condition: executionCondition,
        expires_at: now.clone().add(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, 'fulfillment')
      .then(result => {
        t.equal(result.previouslyFulfilled, false)
        t.end()
      })
    })

    fulfillmentTest.test('throw error if current time is greater than expired_at', t => {
      CryptoConditions.validateFulfillment.returns(true)

      const transfer = {
        state: TransferState.PREPARED,
        execution_condition: executionCondition,
        expires_at: now.clone().subtract(1, 'hour').unix()
      }

      Validator.validateFulfillment(transfer, 'fulfillment')
      .then(result => {
        t.fail('Expected exception')
      })
      .catch(Errors.ExpiredTransferError, e => {
        t.pass()
      })
      .catch(e => {
        t.fail('Expected ExpiredTransferError')
      })
      .then(t.end)
    })

    fulfillmentTest.end()
  })

  validatorTest.test('validateExistingOnPrepare should', existingPrepareTest => {
    const assertAlreadyExistsError = (t, proposed, existing) => {
      Validator.validateExistingOnPrepare(proposed, existing)
      .then(() => {
        t.fail('Expected exception')
      })
      .catch(Errors.InvalidModificationError, e => {
        t.equal(e.message, 'Transfer may not be modified in this way')
      })
      .catch(() => {
        t.fail('Expected InvalidModificationError')
      })
      .then(t.end)
    }

    existingPrepareTest.test('reject if proposed does not equal existing', t => {
      const proposed = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }
      const existing = _.omit(proposed, ['debits'])
      existing.state = TransferState.PREPARED

      assertAlreadyExistsError(t, proposed, _.omit(proposed, ['debits']))
    })

    existingPrepareTest.test('return existing if existing matches proposed', t => {
      const proposed = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }
      const existing = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        state: TransferState.PREPARED,
        $save: () => {},
        $setIdOnCreation: () => {}
      }

      Validator.validateExistingOnPrepare(proposed, existing)
      .then(result => {
        t.equal(result, existing)
        t.end()
      })
    })

    existingPrepareTest.test('not match id', t => {
      const proposed = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }
      const existing = {
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        state: TransferState.PREPARED,
        $save: () => {},
        $setIdOnCreation: () => {}
      }

      Validator.validateExistingOnPrepare(proposed, existing)
      .then(result => {
        t.equal(result, existing)
        t.end()
      })
    })

    existingPrepareTest.test('throw error when existing is not prepared', t => {
      const proposed = { execution_condition: 'condition' }
      const existing = {
        state: TransferState.EXECUTED,
        execution_condition: 'condition'
      }

      assertAlreadyExistsError(t, proposed, existing)
    })

    existingPrepareTest.test('not throw error if transfer is unconditional', test => {
      const proposed = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ]
      }
      const existing = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ],
        state: TransferState.EXECUTED,
        $save: () => {},
        $setIdOnCreation: () => {}
      }

      Validator.validateExistingOnPrepare(proposed, existing)
      .then(result => {
        test.equal(result, existing)
        test.end()
      })
    })

    existingPrepareTest.test('throw error if transfer is unconditional and does not match', test => {
      const proposed = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50'
          }
        ]
      }
      const existing = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            account: 'http://usd-ledger.example/USD/accounts/bob',
            amount: '50.1'
          }
        ],
        state: TransferState.EXECUTED,
        $save: () => {},
        $setIdOnCreation: () => {}
      }

      assertAlreadyExistsError(test, proposed, existing)
    })

    existingPrepareTest.end()
  })

  validatorTest.test('validateReject should', rejectTest => {
    rejectTest.test('throw TransferNotConditionalError if unconditional transfer', test => {
      const transfer = {
        state: TransferState.PREPARED
      }

      Validator.validateReject(transfer, 'rejection reason')
        .then(() => {
          test.fail('Expected exception to be thrown')
        }).catch(Errors.TransferNotConditionalError, e => {
          test.equal(e.message, 'Transfer is not conditional')
        }).catch(e => {
          test.fail(e.message)
        })
        .then(test.end)
    })

    rejectTest.test('return alreadyRejected if state is rejected and rejectionReason matches', test => {
      const rejectionReason = 'r-e-j-e-c-t find out what it means to me'
      const transfer = {
        state: TransferState.REJECTED,
        execution_condition: executionCondition,
        rejection_reason: rejectionReason
      }

      Validator.validateReject(transfer, rejectionReason)
      .then(result => {
        test.equal(result.alreadyRejected, true)
        test.end()
      })
    })

    rejectTest.test('throw UnauthorizedError if requesting account does not match credit account', test => {
      const name = 'dfsp2'
      const accountUri = UrlParser.toAccountUri(name) + '1'
      const transfer = {
        execution_condition: 'condition',
        credits: [{
          amount: 1,
          account: accountUri
        }]
      }

      Validator.validateReject(transfer, 'reason', { name })
      .then(() => {
        test.fail('Expected exception')
      })
      .catch(Errors.UnauthorizedError, e => {
        test.equal(e.message, 'Invalid attempt to reject credit')
      })
      .catch(e => {
        test.fail('Expected UnauthorizedError but caught ' + e.constructor.name)
      })
      .then(test.end)
    })

    rejectTest.test('throw InvalidModificationError if state is executed', test => {
      const rejectionReason = 'Dear John,'
      const transfer = {
        state: TransferState.EXECUTED,
        execution_condition: executionCondition,
        rejection_reason: 'not ' + rejectionReason
      }

      Validator.validateReject(transfer, rejectionReason)
      .then(() => {
        test.fail('Expected exception to be thrown')
      }).catch(Errors.InvalidModificationError, e => {
        test.equal(e.message, 'Transfers in state executed may not be rejected')
      }).catch(e => {
        test.fail('Expected InvalidModificationError')
      })
      .then(test.end)
    })

    rejectTest.test('return alreadyReject false if all transfer is not rejected', test => {
      const rejectionReason = "It's not you, it's me"
      const transfer = {
        state: TransferState.PREPARED,
        execution_condition: executionCondition
      }

      Validator.validateReject(transfer, rejectionReason)
      .then(result => {
        test.equal(result.alreadyRejected, false)
      })
      .catch(e => {
        test.fail(e.message)
      })
      .then(test.end)
    })
    rejectTest.end()
  })

  validatorTest.test('validateSettle should', settleTest => {
    settleTest.test('throw error when not executed', test => {
      const transfer = {
        state: TransferState.PREPARED
      }

      Validator.validateSettle(transfer)
      .then(() => {
        test.fail('Expected exception')
      })
      .catch(Errors.UnexecutedTransferError, e => {
        test.equal(e.message, 'The provided entity is syntactically correct, but there is a generic semantic problem with it.')
      })
      .catch(() => {
        test.fail('Expected UnexecutedTransferError')
      })
      .then(test.end)
    })

    settleTest.test('return transfer if executed', test => {
      const transfer = {
        state: TransferState.EXECUTED
      }

      Validator.validateSettle(transfer)
      .then(() => {
        test.pass()
      })
      .catch(() => {
        test.fail('Expected no exception to be thrown')
      })
      .then(test.end)
    })

    settleTest.end()
  })

  validatorTest.end()
})
