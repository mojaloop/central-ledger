'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const Moment = require('moment')
const P = require('bluebird')
const Config = require('../../../../src/lib/config')
const UrlParser = require('../../../../src/lib/urlparser')
const Account = require('../../../../src/domain/account')
const Validator = require('../../../../src/api/transfers/validator')
const ValidationError = require('../../../../src/errors').ValidationError
const CryptoConditions = require('../../../../src/crypto-conditions')

let assertValidationError = (promise, assert, message) => {
  promise.then(a => {
    assert.fail('fail fail fail')
    assert.end()
  })
    .catch(e => {
      assert.ok(e instanceof ValidationError)
      assert.equal(e.message, message)
      assert.end()
    })
}

Test('transfer validator', (test) => {
  const allowedScale = 2
  const allowedPrecision = 10
  const hostname = 'http://some-hostname'
  const badAccountUri = 'bad_account_uri'
  const badPrecisionAmount = '100000000.23'
  const badScaleAmount = '1.123'
  const expiredAt = Moment('2016-12-26T00:00:01.000Z').utc()
  let transferId
  let originalPrecision
  let originalHostName
  let sandbox

  const goodTransfer = () => {
    transferId = Uuid()
    const account1Name = 'some_account_name'
    const account2Name = 'other_account_name'
    const transferIdUri = `${hostname}/transfers/${transferId}`

    let account1Uri = `${hostname}/accounts/${account1Name}`
    let account2Uri = `${hostname}/accounts/${account2Name}`
    Account.getByName.withArgs(account1Name).returns(P.resolve({}))
    Account.getByName.withArgs(account2Name).returns(P.resolve({}))

    UrlParser.nameFromAccountUri.withArgs(badAccountUri).returns(null)
    UrlParser.nameFromAccountUri.withArgs(account1Uri).returns(account1Name)
    UrlParser.nameFromAccountUri.withArgs(account2Uri).returns(account2Name)
    UrlParser.idFromTransferUri.withArgs(transferIdUri).returns(transferId)

    return {
      id: transferIdUri,
      ledger: hostname,
      credits: [
        {
          account: account1Uri,
          amount: '50.00'
        }
      ],
      debits: [
        {
          account: account2Uri,
          amount: '50.00'
        }
      ],
      execution_condition: 'execution condition',
      expires_at: expiredAt.toISOString()
    }
  }

  test.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(UrlParser, 'nameFromAccountUri')
    sandbox.stub(UrlParser, 'idFromTransferUri')
    sandbox.stub(Account, 'getByName')
    sandbox.stub(Moment, 'utc')
    sandbox.stub(CryptoConditions, 'validateCondition')
    CryptoConditions.validateCondition.returns(true)
    Moment.utc.returns(expiredAt.add(1, 'hour'))
    originalHostName = Config.HOSTNAME
    originalPrecision = Config.AMOUNT.PRECISION
    originalHostName = Config.HOSTNAME
    Config.AMOUNT.SCALE = allowedScale
    Config.AMOUNT.PRECISION = allowedPrecision
    Config.HOSTNAME = hostname
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    t.end()
  })

  test.afterEach((t) => {
    sandbox.restore()
    Config.AMOUNT.PRECISION = originalPrecision
    Config.HOSTNAME = originalHostName
    Config.LEDGER_ACCOUNT_NAME = 'LEDGER_ACCOUNT_NAME'
    t.end()
  })

  test.test('reject if transfer null', assert => {
    assertValidationError(Validator.validate(null, transferId), assert, 'Transfer must be provided')
  })

  test.test('reject if transfer.ledger is not hostname', assert => {
    let transfer = goodTransfer()
    transfer.ledger = 'not-host-name'
    assertValidationError(Validator.validate(transfer, transferId), assert, 'transfer.ledger is not valid for this ledger')
  })

  test.test('reject if transfer.credits.account is not parseable', assert => {
    let transfer = goodTransfer()
    transfer.credits[0].account = badAccountUri
    assertValidationError(Validator.validate(transfer, transferId), assert, `Invalid account URI: ${badAccountUri}`)
  })

  test.test('reject if transfer.debits.account is not parseable', assert => {
    let transfer = goodTransfer()
    transfer.debits[0].account = badAccountUri
    assertValidationError(Validator.validate(transfer, transferId), assert, `Invalid account URI: ${badAccountUri}`)
  })

  test.test('reject if transfer.credits.account name does not exist', assert => {
    let badAccountName = 'bad_account_name'
    let accountUri = 'some-debit-account'
    let transfer = goodTransfer()
    transfer.credits[0].account = accountUri
    UrlParser.nameFromAccountUri.withArgs(accountUri).returns(badAccountName)
    Account.getByName.withArgs(badAccountName).returns(P.resolve(null))
    assertValidationError(Validator.validate(transfer, transferId), assert, `Account ${badAccountName} not found`)
  })

  test.test('reject if transfer.debits.account name does not exist', assert => {
    let badAccountName = 'bad_account_name'
    let accountUri = 'some-debit-account'
    let transfer = goodTransfer()
    transfer.debits[0].account = accountUri
    UrlParser.nameFromAccountUri.withArgs(accountUri).returns(badAccountName)
    Account.getByName.withArgs(badAccountName).returns(P.resolve(null))
    assertValidationError(Validator.validate(transfer, transferId), assert, `Account ${badAccountName} not found`)
  })

  test.test('reject if transfer.credits.account name is the ledger account name', assert => {
    let badAccountName = Config.LEDGER_ACCOUNT_NAME
    let accountUri = 'some-debit-account'
    let transfer = goodTransfer()
    transfer.credits[0].account = accountUri
    UrlParser.nameFromAccountUri.withArgs(accountUri).returns(badAccountName)
    Account.getByName.withArgs(badAccountName).returns(P.resolve({}))
    assertValidationError(Validator.validate(transfer, transferId), assert, `Account ${badAccountName} not found`)
  })

  test.test('reject if transfer.debits.account name is the ledger account name', assert => {
    let badAccountName = Config.LEDGER_ACCOUNT_NAME
    let accountUri = 'some-debit-account'
    let transfer = goodTransfer()
    transfer.debits[0].account = accountUri
    UrlParser.nameFromAccountUri.withArgs(accountUri).returns(badAccountName)
    Account.getByName.withArgs(badAccountName).returns(P.resolve({}))
    assertValidationError(Validator.validate(transfer, transferId), assert, `Account ${badAccountName} not found`)
  })

  test.test('reject if transfer.id is not url', assert => {
    let transfer = goodTransfer()
    transfer.id = 'jfksjfskaljfsljflkasjflsa'
    UrlParser.idFromTransferUri.withArgs(transfer.id).returns(null)
    assertValidationError(Validator.validate(transfer, transferId), assert, 'transfer.id: Invalid URI')
  })

  test.test('reject if transfer.id uuid does not match provided transferId', assert => {
    let transfer = goodTransfer()
    assertValidationError(Validator.validate(transfer, Uuid()), assert, 'transfer.id: Invalid URI')
  })

  test.test('reject if transfer.credits.amount precision is too high', assert => {
    let transfer = goodTransfer()
    transfer.credits[0].amount = badPrecisionAmount

    assertValidationError(Validator.validate(transfer, transferId), assert, `Amount ${badPrecisionAmount} exceeds allowed precision of ${allowedPrecision}`)
  })

  test.test('reject if transfer.credits.amount scale is too high', assert => {
    let transfer = goodTransfer()
    transfer.credits[0].amount = badScaleAmount

    assertValidationError(Validator.validate(transfer, transferId), assert, `Amount ${badScaleAmount} exceeds allowed scale of ${allowedScale}`)
  })

  test.test('reject if transfer.debits.amount precision is too high', assert => {
    let transfer = goodTransfer()
    transfer.debits[0].amount = badPrecisionAmount

    assertValidationError(Validator.validate(transfer, transferId), assert, `Amount ${badPrecisionAmount} exceeds allowed precision of ${allowedPrecision}`)
  })

  test.test('reject if transfer.debits.amount scale is too high', assert => {
    let transfer = goodTransfer()
    transfer.debits[0].amount = badScaleAmount

    assertValidationError(Validator.validate(transfer, transferId), assert, `Amount ${badScaleAmount} exceeds allowed scale of ${allowedScale}`)
  })

  test.test('reject if transfer.execution_condition is invalid', assert => {
    const condition = 'condition'
    const errorMessage = 'error message'
    const transfer = goodTransfer()
    CryptoConditions.validateCondition.withArgs(condition).throws(new ValidationError(errorMessage))

    transfer.execution_condition = condition
    assertValidationError(Validator.validate(transfer, transferId), assert, errorMessage)
  })

  test.test('reject if expires_at is null when execution_condition populated', assert => {
    const condition = 'condition'
    const transfer = goodTransfer()
    CryptoConditions.validateCondition.returns(true)

    transfer.execution_condition = condition
    transfer.expires_at = null

    assertValidationError(Validator.validate(transfer, transferId), assert, 'expires_at: required for conditional transfer')
  })

  test.test('reject if transfer.expires_at has already passed', assert => {
    let transfer = goodTransfer()
    transfer.expires_at = Moment(expiredAt).subtract(1, 'year').toISOString()
    assertValidationError(Validator.validate(transfer, transferId), assert, `expires_at date: ${transfer.expires_at} has already expired.`)
  })

  test.test('return transfer if all checks pass', assert => {
    let transfer = goodTransfer()
    Validator.validate(transfer, transferId)
      .then(t => {
        assert.ok(Account.getByName.calledTwice)
        assert.equal(t, transfer)
        assert.end()
      })
  })

  test.test('return unconditional transfer if all checks pass', assert => {
    const transfer = goodTransfer()
    transfer.execution_condition = null
    Validator.validate(transfer, transferId)
      .then(t => {
        assert.ok(Account.getByName.calledTwice)
        assert.equal(t, transfer)
        assert.end()
      })
  })

  test.test('call Account.getByName once if same account name', assert => {
    let transfer = goodTransfer()
    transfer.debits[0].account = transfer.credits[0].account

    Validator.validate(transfer, transferId)
      .then(t => {
        assert.ok(Account.getByName.calledOnce)
        assert.equal(t, transfer)
        assert.end()
      })
  })

  test.end()
})
