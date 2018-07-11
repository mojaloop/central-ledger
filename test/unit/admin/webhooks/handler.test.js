'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Uuid = require('uuid4')
const P = require('bluebird')
const TransferService = require('../../../../src/domain/transfer')
const FeeService = require('../../../../src/domain/fee')
const TokenService = require('../../../../src/domain/token')
const Handler = require('../../../../src/admin/webhooks/handler')
const Sidecar = require('../../../../src/lib/sidecar')
const SettlementService = require('../../../../src/domain/settlement')

function createRequest (id, payload) {
  let requestId = id || Uuid()
  let requestPayload = payload || {}
  return {
    payload: requestPayload,
    params: {id: requestId},
    server: {
      log: function () { }
    }
  }
}

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

Test('Handler Test', handlerTest => {
  let sandbox

  handlerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransferService, 'rejectExpired')
    sandbox.stub(TransferService, 'settle')
    sandbox.stub(FeeService, 'settleFeeForTransfers')
    sandbox.stub(TokenService, 'removeExpired')
    sandbox.stub(Sidecar, 'logRequest')
    sandbox.stub(SettlementService)
    t.end()
  })

  handlerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  handlerTest.test('rejectExpired should', rejectExpiredTest => {
    rejectExpiredTest.test('return rejected transfer ids', async function (test) {
      let transferIds = [Uuid(), Uuid(), Uuid()]
      TransferService.rejectExpired.returns(P.resolve(transferIds))
      const response = await Handler.rejectExpired({}, {})
      test.equal(response, transferIds)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    rejectExpiredTest.test('return error if rejectExpired fails', async function (test) {
      let error = new Error()
      TransferService.rejectExpired.returns(P.reject(error))
      try {
        await Handler.rejectExpired(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    rejectExpiredTest.end()
  })

  handlerTest.test('settle should', settleTest => {
    settleTest.test('return settled transfer and fee ids', async function (test) {
      const participant1 = {participantNumber: '1234', routingNumber: '5678', name: 'Bill'}
      const participant2 = {participantNumber: '2345', routingNumber: '6789', name: 'Will'}
      const participant3 = {participantNumber: '3456', routingNumber: '7890', name: 'Rob'}
      let transfers = [
        generateTransfer(participant1, participant2, '10.00'),
        generateTransfer(participant1, participant2, '10.00'),
        generateTransfer(participant1, participant2, '5.00'),
        generateTransfer(participant2, participant1, '10.00'),
        generateTransfer(participant1, participant3, '10.00'),
        generateTransfer(participant3, participant1, '10.00')
      ]
      let fee = [
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant1, participant2, '5.00'),
        generateFee(participant2, participant1, '10.00'),
        generateFee(participant1, participant3, '10.00'),
        generateFee(participant3, participant1, '15.00')
      ]
      TransferService.settle.returns(P.resolve(transfers))
      FeeService.settleFeeForTransfers.returns(P.resolve(fee))

      const settledTransfers = [{
        amount: {
          currency_code: 'TZS',
          description: participant1.name,
          value: '15.00'
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
          value: '15.00'
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
      await Handler.settle({}, {})
      test.deepEqual(settledTransfers, settledFee)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    settleTest.test('return error if settlement failed', async function (test) {
      let error = new Error()
      TransferService.settle.returns(P.reject(error))
      try {
        await Handler.settle(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    settleTest.end()
  })

  handlerTest.test('removeExpired should', removeExpiredTest => {
    removeExpiredTest.test('return expired tokens', async function (test) {
      let tokenIds = [Uuid(), Uuid(), Uuid()]
      TokenService.removeExpired.returns(P.resolve(tokenIds))
      const response = await Handler.rejectExpiredTokens({}, {})
      test.equal(response, tokenIds)
      test.ok(Sidecar.logRequest.calledWith({}))
      test.end()
    })

    removeExpiredTest.test('return error if removeExpired fails', async function (test) {
      let error = new Error()
      TokenService.removeExpired.returns(P.reject(error))
      try {
        await Handler.rejectExpiredTokens(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    removeExpiredTest.end()
  })

  handlerTest.end()
})
