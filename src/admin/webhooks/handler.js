'use strict'

const Decimal = require('decimal.js')
const Util = require('../../../src/lib/util')
const TransferService = require('../../domain/transfer')
const FeeService = require('../../domain/fee')
const TokenService = require('../../domain/token')
const Sidecar = require('../../lib/sidecar')

const mapToSettlement = (settlement) => {
  return {
    source: {
      account_number: settlement.sourceAccountNumber,
      routing_number: settlement.sourceRoutingNumber
    },
    destination: {
      account_number: settlement.destinationAccountNumber,
      routing_number: settlement.destinationRoutingNumber
    },
    amount: {
      currency_code: 'USD',
      value: settlement.creditAmount || settlement.payerAmount,
      description: settlement.debitAccountName || settlement.payerAccountName
    }
  }
}

const addToSettlement = (settlement1, settlement2) => {
  const settlement1Val = new Decimal(settlement1.amount.value)
  const settlement2Val = new Decimal(settlement2.amount.value)
  settlement1.amount.value = settlement1Val.plus(settlement2Val).valueOf()
  return settlement1
}

const calculateSettlements = (settlement, settlementMap) => {
  if (settlement.length === 0) {
    return settlementMap
  } else {
    const head = settlement[0]
    const tail = (settlement.length > 1) ? settlement.slice(1) : []

    const key = `${head.source.account_number}${head.source.routing_number}to${head.destination.account_number}${head.destination.routing_number}`

    if (settlementMap.has(key)) {
      settlementMap.set(key, addToSettlement(settlementMap.get(key), head))
    } else {
      settlementMap.set(key, head)
    }
    return calculateSettlements(tail, settlementMap)
  }
}

const flattenSettlements = (settlementMap) => {
  const flattenedSettlements = []

  settlementMap.forEach(settlement => {
    const inverseKey = `${settlement.destination.account_number}${settlement.destination.routing_number}to${settlement.source.account_number}${settlement.source.routing_number}`
    const inverseSettlement = settlementMap.get(inverseKey)

    const val = new Decimal(settlement.amount.value)
    let inverseVal = new Decimal('0')

    if (inverseSettlement) {
      settlementMap.delete(inverseKey)
      inverseVal = new Decimal(inverseSettlement.amount.value)
      if (val.greaterThan(inverseVal)) {
        settlement.amount.value = Util.formatAmount(val.minus(inverseVal).valueOf())
      } else {
        inverseSettlement.amount.value = Util.formatAmount(inverseVal.minus(val).valueOf())
        settlement = inverseSettlement
      }
    }

    if (!val.equals(inverseVal)) {
      flattenedSettlements.push(settlement)
    }
  })
  return flattenedSettlements
}

exports.rejectExpired = function (request, reply) {
  Sidecar.logRequest(request)
  return TransferService.rejectExpired()
    .then(response => reply(response))
    .catch(e => reply(e))
}

exports.settle = function (request, reply) {
  Sidecar.logRequest(request)
  return TransferService.settle()
    .then(settledTransfers => {
      return FeeService.settleFeesForTransfers(settledTransfers)
        .then(settledFees => {
          const transferSettlements = flattenSettlements(calculateSettlements(settledTransfers.map(settledTransfers => mapToSettlement(settledTransfers)), new Map()))
          const feeSettlements = flattenSettlements(calculateSettlements(settledFees.map(settledFees => mapToSettlement(settledFees)), new Map()))
          return reply({ transfers: transferSettlements, fees: feeSettlements })
        })
    })
    .catch(e => reply(e))
}

exports.rejectExpiredTokens = function (request, reply) {
  Sidecar.logRequest(request)
  return TokenService.removeExpired()
    .then(response => reply(response))
    .catch(e => reply(e))
}
