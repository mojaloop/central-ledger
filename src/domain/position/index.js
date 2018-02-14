'use strict'

const _ = require('lodash')
const Decimal = require('decimal.js')
const UrlParser = require('../../lib/urlparser')
const PositionCalculator = require('./position-calculator')
const Account = require('../../domain/account')
const Fee = require('../../domain/fee')
const SettleableTransfersReadmodel = require('../../models/settleable-transfers-read-model')
const P = require('bluebird')

const buildPosition = (payments, receipts, net) => {
  return {
    payments: payments,
    receipts: receipts,
    net: net
  }
}

const buildEmptyPosition = () => {
  return buildPosition(new Decimal('0'), new Decimal('0'), new Decimal('0'))
}

const buildResponse = (positionMap) => {
  return Array.from(positionMap.keys()).sort().map(p => _.assign({ account: p }, _.forOwn(positionMap.get(p), (value, key, obj) => (obj[key] = value.toString()))))
}

const mapFeeToExecuted = (fee) => {
  return {
    account: fee.account,
    debitAmount: fee.payerAmount,
    creditAmount: fee.payeeAmount,
    debitAccountName: fee.payerAccountName,
    creditAccountName: fee.payeeAccountName
  }
}

const calculatePositions = (executed, positionMap) => {
  if (executed.length === 0) {
    return positionMap
  } else {
    const head = executed[0]
    const tail = (executed.length > 1) ? executed.slice(1) : []

    const addToExistingPositionFor = (key) => {
      if (positionMap.has(key)) {
        return v => positionMap.set(key, PositionCalculator.sum(positionMap.get(key), v))
      } else {
        return v => positionMap.set(key, v)
      }
    }

    const debitAccount = UrlParser.toAccountUri(head.debitAccountName)
    const creditAccount = UrlParser.toAccountUri(head.creditAccountName)

    addToExistingPositionFor(debitAccount)(buildPosition(new Decimal(head.debitAmount), new Decimal('0'), (new Decimal(head.debitAmount)).times(-1)))
    addToExistingPositionFor(creditAccount)(buildPosition(new Decimal('0'), new Decimal(head.creditAmount), new Decimal(head.creditAmount)))

    return calculatePositions(tail, positionMap)
  }
}

const generatePosition = (accountUri, transferPositions, feePositions) => {
  const transferAmount = new Decimal(transferPositions.net)
  const feeAmount = new Decimal(feePositions.net)

  delete transferPositions.account
  delete feePositions.account

  return {
    account: accountUri,
    fees: feePositions,
    transfers: transferPositions,
    net: transferAmount.plus(feeAmount).valueOf()
  }
}

exports.calculateForAccount = (account) => {
  const accountUri = UrlParser.toAccountUri(account.name)
  const transferPositionMap = new Map().set(accountUri, buildEmptyPosition())
  const feePositionMap = new Map().set(accountUri, buildEmptyPosition())

  return P.all([SettleableTransfersReadmodel.getUnsettledTransfersByAccount(account.accountId), Fee.getUnsettledFeesByAccount(account)]).then(([transfers, fees]) => {
    const transferPositions = buildResponse(calculatePositions(transfers, transferPositionMap)).find(x => x.account === accountUri)
    const feePositions = buildResponse(calculatePositions(fees.map(mapFeeToExecuted), feePositionMap)).find(x => x.account === accountUri)

    return generatePosition(accountUri, transferPositions, feePositions)
  })
}

exports.calculateForAllAccounts = () => {
  return Account.getAll()
    .then(accounts => {
      if (!accounts || accounts.length === 0) {
        return []
      }
      const transferPositionMap = new Map()
      const feePositionMap = new Map()

      accounts.forEach(account => {
        transferPositionMap.set(UrlParser.toAccountUri(account.name), buildEmptyPosition())
        feePositionMap.set(UrlParser.toAccountUri(account.name), buildEmptyPosition())
      })
      return P.all([SettleableTransfersReadmodel.getUnsettledTransfers(), Fee.getUnsettledFees()]).then(([transfers, fees]) => {
        const transferPositions = buildResponse(calculatePositions(transfers, transferPositionMap))
        const feePositions = buildResponse(calculatePositions(fees.map(mapFeeToExecuted), feePositionMap))
        var positions = []
        accounts.forEach(account => {
          const accountUri = UrlParser.toAccountUri(account.name)
          const accountTransferPositions = transferPositions.find(x => x.account === accountUri)
          const accountFeePositions = feePositions.find(x => x.account === accountUri)

          positions.push(generatePosition(accountUri, accountTransferPositions, accountFeePositions))
        })
        return positions
      })
    })
}
