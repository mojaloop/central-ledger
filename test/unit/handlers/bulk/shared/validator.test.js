'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { randomUUID } = require('crypto')
const BulkTransfer = require('#src/domain/bulkTransfer/index')
const Validator = require('#src/handlers/bulk/shared/validator')
const Config = require('../../../../../src/lib/config')

let payload
let headers

Test('bulkTransfer validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    payload = {
      bulkTransferState: 'COMPLETED',
      completedTimestamp: new Date(),
      individualTransferResults: [{
        transferId: randomUUID(),
        fulfilment: 'adlcfFFpGkn3dDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI'
      }]
    }
    headers = {
      'fspiop-source': 'dfsp2',
      'fspiop-destination': 'dfsp1'
    }
    sandbox = Sinon.createSandbox()
    sandbox.stub(BulkTransfer, 'getParticipantsById')
    test.end()
  })

  validatorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  validatorTest.test('validateBulkTransferFulfilment should', validateBulkTransferFulfilmentTest => {
    validateBulkTransferFulfilmentTest.test('pass validation for valid payload', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))

      const {
        isValid
      } = await Validator.validateBulkTransferFulfilment(payload, headers)
      test.equal(isValid, true)
      test.end()
    })

    validateBulkTransferFulfilmentTest.test('fail for no payload', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))

      const {
        isValid, reasons
      } = await Validator.validateBulkTransferFulfilment(null, headers)
      test.equal(reasons[0].apiErrorCode.code, '3100')
      test.equal(reasons[0].apiErrorCode.message, 'Generic validation error')
      test.equal(isValid, false)
      test.end()
    })

    validateBulkTransferFulfilmentTest.test('fail on invalid payer', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))
      headers = {
        'fspiop-source': 'dfsp2',
        'fspiop-destination': 'invalidPayer'
      }
      const {
        isValid, reasons
      } = await Validator.validateBulkTransferFulfilment(payload, headers)
      test.equal(reasons[0].apiErrorCode.code, '3100')
      test.equal(reasons[0].apiErrorCode.message, 'Generic validation error')
      test.equal(reasons[0].message, 'FSPIOP-Destination header should match Payer FSP')
      test.equal(isValid, false)
      test.end()
    })

    validateBulkTransferFulfilmentTest.test('fail on invalid payee', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))
      headers = {
        'fspiop-source': 'invalidPayee',
        'fspiop-destination': 'dfsp1'
      }
      const {
        isValid, reasons
      } = await Validator.validateBulkTransferFulfilment(payload, headers)
      test.equal(reasons[0].apiErrorCode.code, '3100')
      test.equal(reasons[0].apiErrorCode.message, 'Generic validation error')
      test.equal(reasons[0].message, 'FSPIOP-Source header should match Payee FSP')
      test.equal(isValid, false)
      test.end()
    })

    validateBulkTransferFulfilmentTest.test('fail on invalid completedTimestamp', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))

      payload.completedTimestamp = new Date((new Date()).getTime() + (10 * 86400000))

      const {
        isValid, reasons
      } = await Validator.validateBulkTransferFulfilment(payload, headers)
      test.equal(reasons[0].apiErrorCode.code, '3100')
      test.equal(reasons[0].apiErrorCode.message, 'Generic validation error')
      test.equal(reasons[0].message, 'Bulk fulfil failed validation - completedTimestamp fails because future timestamp was provided')
      test.equal(isValid, false)
      test.end()
    })

    validateBulkTransferFulfilmentTest.test('fail on completedTimestamp exceeds timeout duration', async (test) => {
      BulkTransfer.getParticipantsById.returns(Promise.resolve({
        payerFsp: 'dfsp1',
        payeeFsp: 'dfsp2'
      }))

      payload.completedTimestamp = new Date((new Date()).getTime() - ((Config.MAX_FULFIL_TIMEOUT_DURATION_SECONDS + 1) * 1000))

      const {
        isValid, reasons
      } = await Validator.validateBulkTransferFulfilment(payload, headers)
      test.equal(reasons[0].apiErrorCode.code, '3100')
      test.equal(reasons[0].apiErrorCode.message, 'Generic validation error')
      test.equal(reasons[0].message, 'Bulk fulfil failed validation - completedTimestamp fails because provided timestamp exceeded the maximum timeout duration')
      test.equal(isValid, false)
      test.end()
    })

    validateBulkTransferFulfilmentTest.end()
  })
  validatorTest.end()
})
