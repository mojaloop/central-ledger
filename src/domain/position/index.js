'use strict'

const _ = require('lodash')
const Decimal = require('decimal.js')
const UrlParser = require('../../lib/urlParser')
const PositionCalculator = require('./positionCalculator')
const Participant = require('../../domain/participant')
const PositionFacade = require('../../models/position/facade')
const SettlementFacade = require('../../models/settlement/facade')
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
  return Array.from(positionMap.keys()).sort().map(p => _.assign({ participant: p }, _.forOwn(positionMap.get(p), (value, key, obj) => (obj[key] = value.toString()))))
}

const mapFeeToExecuted = (fee) => {
  return {
    participant: fee.participant,
    payeeAmount: fee.payerAmount,
    payerAmount: fee.payeeAmount,
    debitParticipantName: fee.payerParticipantName,
    creditParticipantName: fee.payeeParticipantName
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

    const debitParticipant = UrlParser.toParticipantUri(head.debitParticipantName)
    const creditParticipant = UrlParser.toParticipantUri(head.creditParticipantName)

    addToExistingPositionFor(debitParticipant)(buildPosition(new Decimal(head.payeeAmount), new Decimal('0'), (new Decimal(head.payeeAmount)).times(-1)))
    addToExistingPositionFor(creditParticipant)(buildPosition(new Decimal('0'), new Decimal(head.payerAmount), new Decimal(head.payerAmount)))

    return calculatePositions(tail, positionMap)
  }
}

const generatePosition = (participantUri, transferPositions, feePositions) => {
  const transferAmount = new Decimal(transferPositions.net)
  const feeAmount = new Decimal(feePositions.net)

  delete transferPositions.participant
  delete feePositions.participant

  return {
    participant: participantUri,
    fee: feePositions,
    transfers: transferPositions,
    net: transferAmount.plus(feeAmount).valueOf()
  }
}

exports.calculateForParticipant = (participant) => {
  const participantUri = UrlParser.toParticipantUri(participant.name)
  const transferPositionMap = new Map().set(participantUri, buildEmptyPosition())
  const feePositionMap = new Map().set(participantUri, buildEmptyPosition())

  return P.all([SettlementFacade.getUnsettledTransfersByParticipant(participant.participantId)]).then(([transfers, fee]) => {
    const transferPositions = buildResponse(calculatePositions(transfers, transferPositionMap)).find(x => x.participant === participantUri)
    const feePositions = buildResponse(calculatePositions(fee.map(mapFeeToExecuted), feePositionMap)).find(x => x.participant === participantUri)

    return generatePosition(participantUri, transferPositions, feePositions)
  })
}

exports.calculateForAllParticipants = () => {
  return Participant.getAll()
    .then(participant => {
      if (!participant || participant.length === 0) {
        return []
      }
      const transferPositionMap = new Map()
      const feePositionMap = new Map()

      participant.forEach(participant => {
        transferPositionMap.set(UrlParser.toParticipantUri(participant.name), buildEmptyPosition())
        feePositionMap.set(UrlParser.toParticipantUri(participant.name), buildEmptyPosition())
      })
      return P.all([SettlementFacade.getUnsettledTransfers()]).then(([transfers, fee]) => {
        const transferPositions = buildResponse(calculatePositions(transfers, transferPositionMap))
        const feePositions = buildResponse(calculatePositions(fee.map(mapFeeToExecuted), feePositionMap))
        var positions = []
        participant.forEach(participant => {
          const participantUri = UrlParser.toParticipantUri(participant.name)
          const participantTransferPositions = transferPositions.find(x => x.participant === participantUri)
          const participantFeePositions = feePositions.find(x => x.participant === participantUri)

          positions.push(generatePosition(participantUri, participantTransferPositions, participantFeePositions))
        })
        return positions
      })
    })
}

exports.changeParticipantPosition = (participantCurrencyId, isReversal, amount, transferStateChange) => {
  return PositionFacade.changeParticipantPositionTransaction(participantCurrencyId, isReversal, amount, transferStateChange)
}

exports.generatePositionPlaceHolder = () => {
  return true
}

exports.calculatePreparePositionsBatch = async (transferList) => {
  return await PositionFacade.prepareChangeParticipantPositionTransaction(transferList)
}
