'use strict'

const Decimal = require('decimal.js')
const Util = require('../../../src/lib/util')
const Events = require('../../lib/events')
const csv = require('../../lib/csv')
const settlementEventListener = require('./settlementEventListener')
// const AccountDatabase = require('../../domain/account')
const Logger = require('@mojaloop/central-services-shared').Logger

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
      currency_code: 'TZS',
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

function transfersMap (settledTransfers) {
  const settledTransfersMap = new Map()
  settledTransfers.forEach(settledTransfer => {
    Logger.info('in loop')
    const debitKey = settledTransfer.debitAccountName
    const creditKey = settledTransfer.creditAccountName
    let debitKeyFound = false
    let creditKeyFound = false

    if (settledTransfersMap.has(debitKey)) {
      Logger.info('debit key found ' + debitKey)
      const settlementArray = settledTransfersMap.get(debitKey)
      settlementArray.push(settledTransfer)
      settledTransfersMap.set(debitKey, settlementArray)
      debitKeyFound = true
    }
    if (settledTransfersMap.has(creditKey)) {
      Logger.info('credit key found ' + creditKey)
      const settlementArray = settledTransfersMap.get(creditKey)
      settlementArray.push(settledTransfer)
      settledTransfersMap.set(creditKey, settlementArray)
      creditKeyFound = true
    }
    if (!debitKeyFound) {
      Logger.info('new key ' + debitKey)
      const newSettlementArray = []
      newSettlementArray.push(settledTransfer)
      settledTransfersMap.set(debitKey, newSettlementArray)
    }
    if (!creditKeyFound) {
      Logger.info('new key ' + creditKey)
      const newSettlementArray = []
      newSettlementArray.push(settledTransfer)
      settledTransfersMap.set(creditKey, newSettlementArray)
    }
  })
  return settledTransfersMap
}

const mailDetails = (settledTransfers, settledFees) => {
  var settledTransfersMap
  Logger.info('Entering transfers')
  settledTransfersMap = transfersMap(settledTransfers)
  Logger.info('out of map')
  for (const [key, value] of settledTransfersMap.entries()) {
    const feesArray = []
    settledFees.forEach(settledFee => {
      const debitKey = settledFee.payerAccountName
      const creditKey = settledFee.payeeAccountName
      if (key === debitKey || key === creditKey) {
        feesArray.push(settledFee)
      }
    })
    Logger.info('iterating map' + key)
    const joinedSettlementJson = csv.joinedSettlementJson(csv.flattenedTransfersJson(value), csv.flattenedFeesJson(feesArray))
    const keys = csv.keys(joinedSettlementJson)
    const csvFile = csv.convertJsonToCsv(joinedSettlementJson, keys)
    const mailInformation = {
      csvFile: csvFile,
      email: String
    }
    // const account = AccountDatabase.getByName(key).catch(account)
    mailInformation.email = 'modusboxemailtest@gmail.com' // this will change to email once nico has the email in database
    Logger.info('calling email')
    Events.emailSettlementCsv(mailInformation)
  }
}

const registerEvents = () => {
  Events.onEmailSettlementCsv(settlementEventListener.sendEmail())
}

const performSettlement = (settledTransfers, settledFees) => {
  registerEvents()
  mailDetails(settledTransfers, settledFees)
  const transferSettlements = flattenSettlements(calculateSettlements(settledTransfers.map(settledTransfers => mapToSettlement(settledTransfers)), new Map()))
  const feeSettlements = flattenSettlements(calculateSettlements(settledFees.map(settledFees => mapToSettlement(settledFees)), new Map()))
  return {transfers: transferSettlements, fees: feeSettlements}
}

module.exports = {
  performSettlement
}
