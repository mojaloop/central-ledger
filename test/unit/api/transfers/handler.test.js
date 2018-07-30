'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const P = require('bluebird')
const Uuid = require('uuid4')
const Fixtures = require('../../../fixtures')
const Validator = require('../../../../src/api/transfers/validator')
const Config = require('../../../../src/lib/config')
const Errors = require('../../../../src/errors')
const Handler = require('../../../../src/api/transfers/handler')
const TransferService = require('../../../../src/domain/transfer')
const TransferState = require('../../../../src/domain/transfer/state')
const executionCondition = 'ni:///sha-256;47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU?fpt=preimage-sha-256&cost=0'
const Sidecar = require('../../../../src/lib/sidecar')

const createRequest = (id, payload) => {
  const requestId = id || Uuid()
  const requestPayload = payload || {}
  return {
    payload: requestPayload,
    params: {id: requestId},
    server: {
      log: () => { }
    }
  }
}

const auth = {
  credentials: {
    name: 'dfsp1'
  }
}

Test('transfer handler', handlerTest => {
  let sandbox
  let originalHostName
  const hostname = 'http://some-host'

  handlerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Validator, 'validate', a => P.resolve(a))
    sandbox.stub(TransferService, 'prepare')
    sandbox.stub(TransferService, 'getById')
    sandbox.stub(TransferService, 'reject')
    sandbox.stub(TransferService, 'fulfil')
    sandbox.stub(TransferService, 'getFulfilment')
    sandbox.stub(Sidecar, 'logRequest')
    originalHostName = Config.HOSTNAME
    Config.HOSTNAME = hostname
    t.end()
  })

  handlerTest.afterEach(t => {
    Config.HOSTNAME = originalHostName
    sandbox.restore()
    t.end()
  })

  handlerTest.test('prepareTransfer should', prepareTransferTest => {
    prepareTransferTest.test('reply with status code 200 if transfer exists', async function (test) {
      const payload = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }

      const transfer = {
        id: payload.id,
        ledger: payload.ledger,
        debits: payload.debits,
        credits: payload.credits,
        execution_condition: payload.execution_condition,
        expires_at: payload.expires_at,
        timeline: {}
      }
      TransferService.prepare.returns(P.resolve({transfer, existing: true}))
      const request = createRequest(Uuid(), payload)
      const reply = {
        response: (response) => {
          test.equal(response.id, transfer.id)
          return {
            code: statusCode => {
              test.equal(statusCode, 200)
              test.ok(Sidecar.logRequest.calledWith(request))
              test.end()
            }
          }
        }
      }
      await Handler.prepareTransfer(request, reply)
    })

    prepareTransferTest.test('reply with status code 201 if transfer does not exist', async function (test) {
      const payload = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }

      const transfer = {
        id: payload.id,
        ledger: payload.ledger,
        debits: payload.debits,
        credits: payload.credits,
        execution_condition: payload.execution_condition,
        expires_at: payload.expires_at,
        timeline: {}
      }

      TransferService.prepare.returns(P.resolve({transfer, existing: false}))

      const reply = {
        response: (response) => {
          test.equal(response.id, transfer.id)
          return {
            code: statusCode => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }

      await Handler.prepareTransfer(createRequest(Uuid(), payload), reply)
    })

    prepareTransferTest.test('return error if transfer not validated', async function (test) {
      const payload = {}
      const errorMessage = 'Error message'
      sandbox.restore()
      const transferId = Uuid()
      const error = new Errors.ValidationError(errorMessage)
      sandbox.stub(Validator, 'validate').withArgs(payload, transferId).returns(P.reject(error))
      sandbox.stub(Sidecar, 'logRequest')

      const request = createRequest(transferId, payload)
      try {
        await Handler.prepareTransfer(request, {})
      } catch (e) {
        test.equal(e, error)
        test.ok(Sidecar.logRequest.calledWith(request))
        test.end()
      }
    })

    prepareTransferTest.test('return error if transfer prepare throws', async function (test) {
      const payload = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z'
      }

      const error = new Error()
      TransferService.prepare.returns(P.reject(error))
      try {
        await Handler.prepareTransfer(createRequest(Uuid(), payload), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    prepareTransferTest.end()
  })

  handlerTest.test('fulfillTransfer should', fulfillTransferTest => {
    fulfillTransferTest.test('return fulfilled transfer', async function (test) {
      const transfer = {
        id: 'https://central-ledger/transfers/3a2a1d9e-8640-4d2d-b06c-84f2cd613204',
        ledger: 'http://usd-ledger.example/USD',
        debits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/alice',
            amount: '50'
          }
        ],
        credits: [
          {
            participant: 'http://usd-ledger.example/USD/participants/bob',
            amount: '50'
          }
        ],
        execution_condition: executionCondition,
        expires_at: '2015-06-16T00:00:01.000Z',
        timeline: {}
      }

      const fulfilment = {id: '3a2a1d9e-8640-4d2d-b06c-84f2cd613204', fulfilment: 'oAKAAA'}

      TransferService.fulfil.returns(P.resolve(transfer))

      const request = createRequest(fulfilment.id, fulfilment.fulfilment)
      const reply = {
        response: (response) => {
          test.equal(response.id, transfer.id)
          test.ok(Sidecar.logRequest.calledWith(request))
          return {
            code: statusCode => {
              test.equal(statusCode, 200)
              test.end()
            }
          }
        }
      }

      await Handler.fulfillTransfer(request, reply)
    })

    fulfillTransferTest.test('return error if transfer service fulfil throws', async function (test) {
      const fulfilment = {id: '3a2a1d9e-8640-4d2d-b06c-84f2cd613204', fulfilment: 'oAKAAA'}
      const error = new Error()
      TransferService.fulfil.returns(P.reject(error))
      try {
        await Handler.fulfillTransfer(createRequest(fulfilment.id, fulfilment.fulfilment), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    fulfillTransferTest.end()
  })

  handlerTest.test('reject transfer', rejectTransferTest => {
    rejectTransferTest.test('should reject transfer', async function (test) {
      const rejectionMessage = Fixtures.rejectionMessage()
      const transferId = '3a2a1d9e-8640-4d2d-b06c-84f2cd613204'
      const request = {
        params: {id: transferId},
        payload: rejectionMessage,
        auth
      }

      TransferService.reject.returns(P.resolve({alreadyRejected: false, transfer: {}}))

      const reply = {
        response: (response) => {
          test.deepEqual(response, rejectionMessage)
          test.ok(TransferService.reject.calledWith(Sinon.match({
            id: transferId,
            rejection_reason: 'cancelled',
            message: rejectionMessage
          })))
          test.ok(Sidecar.logRequest.calledWith(request))
          return {
            code: statusCode => {
              test.equal(statusCode, 201)
              test.end()
            }
          }
        }
      }
      await Handler.rejectTransfer(request, reply)
    })

    rejectTransferTest.test('should reject rejected transfer', async function (test) {
      const rejectionMessage = Fixtures.rejectionMessage()
      const transferId = '3a2a1d9e-8640-4d2d-b06c-84f2cd613204'
      const request = {
        params: {id: transferId},
        payload: rejectionMessage,
        auth
      }

      TransferService.reject.returns(P.resolve({alreadyRejected: true, transfer: {}}))

      const reply = {
        response: (response) => {
          test.deepEqual(response, rejectionMessage)
          test.ok(TransferService.reject.calledWith(Sinon.match({
            id: transferId,
            rejection_reason: 'cancelled',
            message: rejectionMessage
          })))
          return {
            code: statusCode => {
              test.equal(statusCode, 200)
              test.end()
            }
          }
        }
      }
      await Handler.rejectTransfer(request, reply)
    })

    rejectTransferTest.test('return error if transfer server reject throws', async function (test) {
      const rejectReason = 'error reason'
      const request = {
        params: {id: '3a2a1d9e-8640-4d2d-b06c-84f2cd613204'},
        payload: rejectReason,
        auth
      }
      const error = new Error()
      TransferService.reject.returns(P.reject(error))
      try {
        await Handler.rejectTransfer(request, {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    rejectTransferTest.end()
  })

  handlerTest.test('getTransferById should', getTransferByIdTest => {
    getTransferByIdTest.test('get transfer by transfer id', async function (test) {
      const id = Uuid()

      const readModelTransfer = {
        transferId: id,
        ledger: hostname,
        payeeParticipantId: 1,
        debitParticipantName: 'dfsp1',
        payeeAmount: '25.00',
        payerParticipantId: 2,
        creditParticipantName: 'dfsp2',
        payerAmount: '15.00',
        payeeRejected: 0,
        executionCondition: executionCondition,
        expirationDate: '2015-06-16T00:00:01.000Z',
        state: TransferState.PREPARED,
        preparedDate: new Date()
      }
      TransferService.getById.returns(P.resolve(readModelTransfer))
      const response = await Handler.getTransferById(createRequest(id), {})
      test.equal(response.id, `${hostname}/transfers/${readModelTransfer.transferId}`)
      test.equal(response.ledger, readModelTransfer.ledger)
      test.equal(response.debits.length, 1)
      test.equal(response.debits[0].participant, `${hostname}/participants/${readModelTransfer.debitParticipantName}`)
      test.equal(response.debits[0].amount, readModelTransfer.payeeAmount)
      test.equal(response.credits.length, 1)
      test.equal(response.credits[0].participant, `${hostname}/participants/${readModelTransfer.creditParticipantName}`)
      test.equal(response.credits[0].amount, readModelTransfer.payerAmount)
      test.notOk(response.credits[0].rejected)
      test.notOk(response.credits[0].rejection_message)
      test.equal(response.execution_condition, readModelTransfer.executionCondition)
      test.equal(response.expires_at, readModelTransfer.expirationDate)
      //  test.equal(response.state, readModelTransfer.state)
      test.ok(response.timeline)
      test.equal(response.timeline.prepared_at, readModelTransfer.preparedDate)
      test.end()
    })

    getTransferByIdTest.test('reply with NotFoundError if transfer null', async function (test) {
      TransferService.getById.returns(P.resolve(null))
      try {
        await Handler.getTransferById(createRequest(), {})
      } catch (e) {
        test.ok(e instanceof Errors.NotFoundError)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    getTransferByIdTest.test('return error if model throws error', async function (test) {
      const error = new Error()
      TransferService.getById.returns(P.reject(error))
      try {
        await Handler.getTransferById(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getTransferByIdTest.end()
  })

  handlerTest.test('getTransferFulfilment should', getTransferFulfilmentTest => {
    getTransferFulfilmentTest.test('get fulfilment by transfer id', async function (test) {
      const id = Uuid()
      const fulfilment = 'oAKAAA'

      TransferService.getFulfilment.withArgs(id).returns(P.resolve(fulfilment))

      const reply = {
        response: (response) => {
          test.equal(response, fulfilment)
          return {
            type: type => {
              test.equal(type, 'text/plain')
              test.end()
            }
          }
        }
      }

      await Handler.getTransferFulfilment(createRequest(id), reply)
    })

    getTransferFulfilmentTest.test('reply with error if service throws', async function (test) {
      const error = new Error()
      TransferService.getFulfilment.returns(P.reject(error))
      try {
        await Handler.getTransferFulfilment(createRequest(), {})
      } catch (e) {
        test.equal(e, error)
        test.end()
      }
    })

    getTransferFulfilmentTest.end()
  })

  handlerTest.end()
})
