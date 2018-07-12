'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Settlement = require('../../../../src/domain/settlement')
const SettlementEventListener = require('../../../../src/domain/settlement/settlementEventListener')
const Logger = require('@mojaloop/central-services-shared').Logger
const Events = require('../../../../src/lib/events')

const participant1 = {participantNumber: '1234', routingNumber: '5678', name: 'Bill'}
const participant2 = {participantNumber: '2345', routingNumber: '6789', name: 'Will'}

function generateTransfer (source, destination, amount) {
  return {
    sourceParticipantNumber: source.participantNumber,
    sourceRoutingNumber: source.routingNumber,
    destinationParticipantNumber: destination.participantNumber,
    destinationRoutingNumber: destination.routingNumber,
    payerAmount: amount,
    debitParticipantName: source.name,
    creditParticipantName: destination.name
  }
}

function generateFee (source, destination, amount) {
  return {
    sourceParticipantNumber: source.participantNumber,
    sourceRoutingNumber: source.routingNumber,
    destinationParticipantNumber: destination.participantNumber,
    destinationRoutingNumber: destination.routingNumber,
    payerAmount: amount,
    payerParticipantName: source.name,
    payeeParticipantName: destination.name
  }
}

const settledTransfers = [{
  amount: {
    currency_code: 'TZS',
    description: participant1.name,
    value: '10.00'
  },
  destination: {
    participant_number: participant2.participantNumber,
    routing_number: participant2.routingNumber
  },
  source: {
    participant_number: participant1.participantNumber,
    routing_number: participant1.routingNumber
  }
}]

const settledFee = [{
  amount: {
    currency_code: 'TZS',
    description: participant1.name,
    value: '5.00'
  },
  destination: {
    participant_number: participant2.participantNumber,
    routing_number: participant2.routingNumber
  },
  source: {
    participant_number: participant1.participantNumber,
    routing_number: participant1.routingNumber
  }
}]

const settledTransfersInverse = [{
  amount: {currency_code: 'TZS', description: 'Bill', value: '1.00'},
  destination: {participant_number: '2345', routing_number: '6789'},
  source: {participant_number: '1234', routing_number: '5678'}
}]

const mockedCompletedSettlement = {
  transfers: settledTransfers,
  fee: settledFee
}

Test('Settlement Test', settlementTest => {
  let sandbox

  settlementTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(SettlementEventListener)
    sandbox.stub(Logger)
    sandbox.stub(Events)
    t.end()
  })

  settlementTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  settlementTest.test('performSettlement should', performSettlementTest => {
    performSettlementTest.test('return flattened transfers and fee', test => {
      let transfers = [
        generateTransfer(participant1, participant2, '10.00')
      ]
      let fee = [
        generateFee(participant1, participant2, '5.00')
      ]
      const settledPosition = Settlement.performSettlement(transfers, fee)
      test.deepEqual(mockedCompletedSettlement, settledPosition)
      test.end()
    })

    performSettlementTest.test('return flattened empty transfers and fee when amounts cancel each other', test => {
      let transfers = [
        generateTransfer(participant1, participant2, '10.00'),
        generateTransfer(participant2, participant1, '10.00')
      ]
      let fee = [
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant2, participant1, '5.00')
      ]
      const settledPosition = Settlement.performSettlement(transfers, fee)
      test.deepEqual({fee: [], transfers: []}, settledPosition)
      test.end()
    })

    performSettlementTest.test('return flattened transfers and fee when amounts are inverse but initial is higher', test => {
      let transfers = [
        generateTransfer(participant1, participant2, '11.00'),
        generateTransfer(participant2, participant1, '10.00')
      ]
      let fee = [
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant2, participant1, '5.00')
      ]
      const settledPosition = Settlement.performSettlement(transfers, fee)
      test.deepEqual({fee: [], transfers: settledTransfersInverse}, settledPosition)
      test.end()
    })

    performSettlementTest.test('return flattened empty transfers and fee when amounts cancel each other', test => {
      let transfers = [
        generateTransfer(participant1, participant2, '10.00'),
        generateTransfer(participant1, participant2, '5.00'),
        generateTransfer(participant2, participant1, '15.00')
      ]
      let fee = [
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant2, participant1, '5.00')
      ]
      const settledPosition = Settlement.performSettlement(transfers, fee)
      test.deepEqual({fee: [], transfers: []}, settledPosition)
      test.end()
    })

    performSettlementTest.end()
  })

  settlementTest.end()
})
