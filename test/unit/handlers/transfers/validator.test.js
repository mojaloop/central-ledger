'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Participant = require('../../../../src/domain/participant')
const Transfer = require('../../../../src/domain/transfer')
const Validator = require('../../../../src/handlers/transfers/validator')
const CryptoConditions = require('../../../../src/cryptoConditions')
const Enum = require('../../../../src/lib/enum')

let payload
let headers

Test('transfer validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    payload = {
      transferId: 'b51ec534-ee48-4575-b6a9-ead2955b8999',
      payerFsp: 'dfsp1',
      payeeFsp: 'dfsp2',
      amount: {
        currency: 'USD',
        amount: '433.88'
      },
      ilpPacket: 'AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA',
      condition: 'YlK5TZyhflbXaDRPtR5zhCu8FrbgvrQwwmzuH0iQ0AI',
      expiration: new Date((new Date()).getTime() + (24 * 60 * 60 * 1000)), // tomorrow
      extensionList: {
        extension: [
          {
            key: 'key1',
            value: 'value1'
          },
          {
            key: 'key2',
            value: 'value2'
          }
        ]
      }
    }
    headers = {
      'fspiop-source': 'dfsp1',
      'fspiop-destination': 'dfsp2'
    }
    sandbox = Sinon.createSandbox()
    sandbox.stub(Participant)
    sandbox.stub(CryptoConditions, 'validateCondition')
    sandbox.stub(Transfer, 'getTransferParticipant')
    test.end()
  })

  validatorTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  validatorTest.test('validateByName should', validateByNameTest => {
    validateByNameTest.test('pass validation for valid payload', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, true)
      test.end()
    })

    validateByNameTest.test('fail validation for no payload', async (test) => {
      const { validationPassed, reasons } = await Validator.validateByName(null)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Transfer must be provided'])
      test.end()
    })

    validateByNameTest.test('fail validation when FSPIOP-Source doesnt match Payer', async (test) => {
      let headersModified = { 'fspiop-source': 'dfsp2' }
      const { validationPassed, reasons } = await Validator.validateByName(payload, headersModified)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['FSPIOP-Source header should match Payer'])
      test.end()
    })

    validateByNameTest.test('fail validation for invalid condition', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.throws(new Error())

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Condition validation failed'])
      test.end()
    })

    validateByNameTest.test('fail validation for no condition', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      payload.condition = null

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Condition is required for a conditional transfer'])
      test.end()
    })

    validateByNameTest.test('Fail validation for invalid expiration date', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.expiration = '1971-11-24T08:38:08.699-04:00'

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Expiration date 1971-11-24T12:38:08.699Z is already in the past'])
      test.end()
    })

    validateByNameTest.test('fail validation for no expiration date', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.expiration = null

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Expiration is required for conditional transfer'])
      test.end()
    })

    validateByNameTest.test('fail validation for invalid participant', async (test) => {
      Participant.getByName.withArgs('dfsp1').returns(P.resolve({ isActive: true }))
      Participant.getByName.withArgs('dfsp2').returns(P.resolve(null))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant dfsp2 not found'])
      test.end()
    })

    validateByNameTest.test('fail validation for inactive participant', async (test) => {
      Participant.getByName.withArgs('dfsp1').returns(P.resolve({ isActive: true }))
      Participant.getByName.withArgs('dfsp2').returns(P.resolve({ isActive: false }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant dfsp2 is inactive'])
      test.end()
    })

    validateByNameTest.test('fail validation for invalid account', async (test) => {
      Participant.getByName.withArgs('dfsp1').returns(P.resolve({ isActive: true }))
      Participant.getByName.withArgs('dfsp2').returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('dfsp1', 'USD', Enum.LedgerAccountType.POSITION).returns(P.resolve({ currencyIsActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('dfsp2', 'USD', Enum.LedgerAccountType.POSITION).returns(P.resolve(null))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant dfsp2 USD account not found'])
      test.end()
    })

    validateByNameTest.test('fail validation for inactive account', async (test) => {
      Participant.getByName.withArgs('dfsp1').returns(P.resolve({ isActive: true }))
      Participant.getByName.withArgs('dfsp2').returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('dfsp1', 'USD', Enum.LedgerAccountType.POSITION).returns(P.resolve({ currencyIsActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('dfsp2', 'USD', Enum.LedgerAccountType.POSITION).returns(P.resolve({ currencyIsActive: false }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant dfsp2 USD account is inactive'])
      test.end()
    })

    validateByNameTest.test('pass validation for valid payload', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.amount.amount = '123.123'

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Amount 123.123 exceeds allowed scale of 2'])
      test.end()
    })

    validateByNameTest.test('fail validation for same payer and payee', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.payeeFsp = payload.payerFsp

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Payer and Payee should be different'])
      test.end()
    })

    validateByNameTest.test('pass validation for valid payload', async (test) => {
      Participant.getByName.returns(P.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(P.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.amount.amount = '12345678901.13'

      const { validationPassed, reasons } = await Validator.validateByName(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Amount 12345678901.13 exceeds allowed precision of 10'])
      test.end()
    })

    validateByNameTest.end()
  })

  validatorTest.test('validateById should', validateByIdTest => {
    validateByIdTest.test('pass validation for valid payload', async (test) => {
      Participant.getById.returns(P.resolve({}))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed } = await Validator.validateById(payload)
      test.equal(validationPassed, true)
      test.end()
    })

    validateByIdTest.test('fail validation for no payload', async (test) => {
      const { validationPassed, reasons } = await Validator.validateById(null)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Transfer must be provided'])
      test.end()
    })

    validateByIdTest.test('fail validation for invalid participant', async (test) => {
      Participant.getById.withArgs('dfsp1').returns(P.resolve({}))
      Participant.getById.withArgs('dfsp2').returns(P.resolve(null))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateById(payload)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant dfsp2 not found'])
      test.end()
    })

    validateByIdTest.end()
  })

  validatorTest.test('validateFulfilCondition should', validateFulfilConditionTest => {
    validateFulfilConditionTest.test('validated fulfilment against condition', async (test) => {
      const fulfilment = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF-'
      const condition = 'aAGyvOxOr4yvZo3TalJwvhdWelZp5JNC0MRqwK4DXQI'
      let result = Validator.validateFulfilCondition(fulfilment, condition)
      test.ok(result)
      test.end()
    })

    validateFulfilConditionTest.test('fail when preimage is less than 32 chars', async (test) => {
      try {
        Validator.validateFulfilCondition(1, 1)
        test.fail('Error not thrown!')
      } catch (err) {
        test.pass('Error thrown')
      }
      test.end()
    })

    validateFulfilConditionTest.end()
  })

  validatorTest.test('validateParticipantTransferId should', validateParticipantTransferIdTest => {
    validateParticipantTransferIdTest.test('validate the transfer id belongs to the requesting fsp', async (test) => {
      const participantName = 'fsp1'
      const transferId = '88416f4c-68a3-4819-b8e0-c23b27267cd5'
      Transfer.getTransferParticipant.withArgs(participantName, transferId).returns(P.resolve([1]))

      const result = await Validator.validateParticipantTransferId(participantName, transferId)
      test.equal(result, true, 'results match')
      test.end()
    })

    validateParticipantTransferIdTest.test('validate the transfer id belongs to the requesting fsp return false for no match', async (test) => {
      const participantName = 'fsp1'
      const transferId = '88416f4c-68a3-4819-b8e0-c23b27267cd5'
      const ledgerAccountTypeId = 1
      Transfer.getTransferParticipant.withArgs(participantName, ledgerAccountTypeId, transferId).returns(P.resolve([]))

      const result = await Validator.validateParticipantTransferId(participantName, transferId)
      test.equal(result, false, 'results match')
      test.end()
    })

    validateParticipantTransferIdTest.end()
  })

  validatorTest.end()
})
