'use strict'

const P = require('bluebird')
const Decimal = require('decimal.js')
const Moment = require('moment')
const Config = require('../../lib/config')
const UrlParser = require('../../lib/urlparser')
const Account = require('../../domain/account')
const ValidationError = require('../../errors').ValidationError
const CryptoConditions = require('../../crypto-conditions')
const Logger = require('@mojaloop/central-services-shared').Logger

const allowedScale = Config.AMOUNT.SCALE
const allowedPrecision = Config.AMOUNT.PRECISION

const validateEntry = (entry) => {
  const accountName = UrlParser.nameFromAccountUri(entry.account)
  if (!accountName) {
    throw new ValidationError(`Invalid account URI: ${entry.account}`)
  }

  const decimalAmount = new Decimal(entry.amount)

  if (decimalAmount.decimalPlaces() > allowedScale) {
    throw new ValidationError(`Amount ${entry.amount} exceeds allowed scale of ${allowedScale}`)
  }

  if (decimalAmount.precision(true) > allowedPrecision) {
    throw new ValidationError(`Amount ${entry.amount} exceeds allowed precision of ${allowedPrecision}`)
  }

  return { accountName, decimalAmount }
}

const validateConditionalTransfer = (transfer) => {
  const executionCondition = transfer.execution_condition
  if (!executionCondition) return
  CryptoConditions.validateCondition(executionCondition)
  if (transfer.expires_at) {
    const expiresAt = Moment(transfer.expires_at)
    if (expiresAt.isBefore(Moment.utc())) {
      throw new ValidationError(`expires_at date: ${expiresAt.toISOString()} has already expired.`)
    }
  } else {
    throw new ValidationError('expires_at: required for conditional transfer')
  }
}

exports.validate = (transfer, transferId) => {
  return P.resolve().then(() => {
    if (!transfer) {
      throw new ValidationError('Transfer must be provided')
    }
    Logger.info('transfer')
    Logger.info(transfer)
    const id = UrlParser.idFromTransferUri(transfer.id)
    if (!id || id !== transferId) {
      throw new ValidationError('transfer.id: Invalid URI')
    }
    if (transfer.ledger !== Config.HOSTNAME) {
      throw new ValidationError('transfer.ledger is not valid for this ledger')
    }

    validateConditionalTransfer(transfer)

    const credit = validateEntry(transfer.credits[0])
    const debit = validateEntry(transfer.debits[0])

    if (debit.accountName === Config.LEDGER_ACCOUNT_NAME || credit.accountName === Config.LEDGER_ACCOUNT_NAME) {
      throw new ValidationError(`Account ${Config.LEDGER_ACCOUNT_NAME} not found`)
    }

    return Array.from(new Set([credit.accountName, debit.accountName]))
  })
    .then(accountNames => {
      return P.all(accountNames.map(n => {
        return Account.getByName(n).then(a => {
          if (a) {
            return a
          } else {
            throw new ValidationError(`Account ${n} not found`)
          }
        })
      }))
    })
    .then(() => transfer)
}
