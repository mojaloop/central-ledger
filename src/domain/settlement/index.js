'use strict'

const Decimal = require('decimal.js')
const Util = require('../../../src/lib/util')
const Events = require('../../lib/events')
const csv = require('../../lib/csv')
const settlementEventListener = require('./settlementEventListener')
// const ParticipantDatabase = require('../../domain/participant')
const Logger = require('@mojaloop/central-services-shared').Logger

const mapToSettlement = (settlement) => {
  return {
    source: {
      participant_number: settlement.sourceParticipantNumber,
      routing_number: settlement.sourceRoutingNumber
    },
    destination: {
      participant_number: settlement.destinationParticipantNumber,
      routing_number: settlement.destinationRoutingNumber
    },
    amount: {
      currency_code: 'TZS',
      value: settlement.payerAmount || settlement.payerAmount,
      description: settlement.debitParticipantName || settlement.payerParticipantName
    }
  }
}

const addToSettlement = (settlement1, settlement2) => {
  const settlement1Val = new Decimal(settlement1.amount.value)
  const settlement2Val = new Decimal(settlement2.amount.value)
  settlement1.amount.value = settlement1Val.plus(settlement2Val).valueOf()
  return settlement1
}

const calculateSettlement = (settlement, settlementMap) => {
  if (settlement.length === 0) {
    return settlementMap
  } else {
    const head = settlement[0]
    const tail = (settlement.length > 1) ? settlement.slice(1) : []

    const key = `${head.source.participant_number}${head.source.routing_number}to${head.destination.participant_number}${head.destination.routing_number}`

    if (settlementMap.has(key)) {
      settlementMap.set(key, addToSettlement(settlementMap.get(key), head))
    } else {
      settlementMap.set(key, head)
    }
    return calculateSettlement(tail, settlementMap)
  }
}

const flattenSettlement = (settlementMap) => {
  const flattenedSettlement = []
  settlementMap.forEach(settlement => {
    const inverseKey = `${settlement.destination.participant_number}${settlement.destination.routing_number}to${settlement.source.participant_number}${settlement.source.routing_number}`
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
      flattenedSettlement.push(settlement)
    }
  })
  return flattenedSettlement
}

function transfersMap (settledTransfers) {
  const settledTransfersMap = new Map()
  settledTransfers.forEach(settledTransfer => {
    Logger.info('in loop')
    const debitKey = settledTransfer.debitParticipantName
    const creditKey = settledTransfer.creditParticipantName
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

const mailDetails = (settledTransfers, settledFee) => {
  var settledTransfersMap
  Logger.info('Entering transfers')
  settledTransfersMap = transfersMap(settledTransfers)
  Logger.info('out of map')
  for (const [key, value] of settledTransfersMap.entries()) {
    const feeArray = []
    settledFee.forEach(settledFee => {
      const debitKey = settledFee.payerParticipantName
      const creditKey = settledFee.payeeParticipantName
      if (key === debitKey || key === creditKey) {
        feeArray.push(settledFee)
      }
    })
    Logger.info('iterating map' + key)
    const joinedSettlementJson = csv.joinedSettlementJson(csv.flattenedTransfersJson(value), csv.flattenedFeeJson(feeArray))
    const keys = csv.keys(joinedSettlementJson)
    const csvFile = csv.convertJsonToCsv(joinedSettlementJson, keys)
    const mailInformation = {
      csvFile: csvFile,
      email: String
    }
    // const participant = ParticipantDatabase.getByName(key).catch(participant)
    mailInformation.email = 'modusboxemailtest@gmail.com' // this will change to email once nico has the email in database
    Logger.info('calling email')
    Events.emailSettlementCsv(mailInformation)
  }
}

const registerEvents = () => {
  Events.onEmailSettlementCsv(settlementEventListener.sendEmail())
}

const performSettlement = (settledTransfers, settledFee) => {
  registerEvents()
  mailDetails(settledTransfers, settledFee)
  const transferSettlement = flattenSettlement(calculateSettlement(settledTransfers.map(settledTransfers => mapToSettlement(settledTransfers)), new Map()))
  const feeSettlement = flattenSettlement(calculateSettlement(settledFee.map(settledFee => mapToSettlement(settledFee)), new Map()))
  return {transfers: transferSettlement, fee: feeSettlement}
}

module.exports = {
  performSettlement
}
