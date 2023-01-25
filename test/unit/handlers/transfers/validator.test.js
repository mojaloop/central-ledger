'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Participant = require('../../../../src/domain/participant')
const Transfer = require('../../../../src/domain/transfer')
const Validator = require('../../../../src/handlers/transfers/validator')
const CryptoConditions = require('../../../../src/cryptoConditions')
const Enum = require('@mojaloop/central-services-shared').Enum

let payload
let headers

Test('transfer validator', validatorTest => {
  let sandbox

  validatorTest.beforeEach(test => {
    payload = {
      transferId: '18c13536-7a17-44ad-aacb-0c9daafa2149',
      payerFsp: 'testingtoolkitdfsp',
      payeeFsp: 'payeefsp',
      amount: {
        currency: 'USD',
        amount: '100'
      },
      ilpPacket: 'AYIDGQAAAAAAACcQHWcucGF5ZWVmc3AubXNpc2RuLjI3NzEzODAzOTEyggLvZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTVRoak1UTTFNell0TjJFeE55MDBOR0ZrTFdGaFkySXRNR001WkdGaFptRXlNVFE1SWl3aWNYVnZkR1ZKWkNJNklqWmhObVE1T1dOaExUUmhaVFF0TkdVeE9DMWlNR1k1TFRsak9Ua3dZall3TVRjMFlpSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpjM01UTTRNRE01TVRJaUxDSm1jM0JKWkNJNkluQmhlV1ZsWm5Od0luMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpRME1USXpORFUyTnpnNUlpd2labk53U1dRaU9pSjBaWE4wYVc1bmRHOXZiR3RwZEdSbWMzQWlmU3dpY0dWeWMyOXVZV3hKYm1adklqcDdJbU52YlhCc1pYaE9ZVzFsSWpwN0ltWnBjbk4wVG1GdFpTSTZJa1pwY25OMGJtRnRaUzFVWlhOMElpd2liR0Z6ZEU1aGJXVWlPaUpNWVhOMGJtRnRaUzFVWlhOMEluMHNJbVJoZEdWUFprSnBjblJvSWpvaU1UazROQzB3TVMwd01TSjlmU3dpWVcxdmRXNTBJanA3SW1GdGIzVnVkQ0k2SWpFd01DSXNJbU4xY25KbGJtTjVJam9pVlZORUluMHNJblJ5WVc1ellXTjBhVzl1Vkhsd1pTSTZleUp6WTJWdVlYSnBieUk2SWxSU1FVNVRSa1ZTSWl3aWFXNXBkR2xoZEc5eUlqb2lVRUZaUlZJaUxDSnBibWwwYVdGMGIzSlVlWEJsSWpvaVEwOU9VMVZOUlZJaWZYMAA',
      condition: 'wqMyoJvKgTYzo7Q0l_h8eJyYnt5GFA8VRZhzy1pemTY',
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
      'fspiop-source': 'testingtoolkitdfsp',
      'fspiop-destination': 'payeefsp'
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

  validatorTest.test('validatePrepare should', validatePrepareTest => {
    validatePrepareTest.test('pass validation for valid payload', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, true)
      test.end()
    })

    validatePrepareTest.test('fail validation for no payload', async (test) => {
      const { validationPassed, reasons } = await Validator.validatePrepare(null)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Transfer must be provided'])
      test.end()
    })

    validatePrepareTest.test('fail validation when FSPIOP-Source doesnt match Payer', async (test) => {
      const headersModified = { 'fspiop-source': 'payeefsp' }
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headersModified)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['FSPIOP-Source header should match Payer'])
      test.end()
    })

    validatePrepareTest.test('fail validation for invalid condition', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.throws(new Error())

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Condition validation failed'])
      test.end()
    })

    validatePrepareTest.test('fail validation for no condition', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      payload.condition = null

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Condition is required for a conditional transfer'])
      test.end()
    })

    validatePrepareTest.test('fail validation for invalid expiration date', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.expiration = '1971-11-24T08:38:08.699-04:00'

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Expiration date 1971-11-24T12:38:08.699Z is already in the past'])
      test.end()
    })

    validatePrepareTest.test('fail validation for no expiration date', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.expiration = null

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Expiration is required for conditional transfer'])
      test.end()
    })

    validatePrepareTest.test('fail validation for invalid participant', async (test) => {
      Participant.getByName.withArgs('testingtoolkitdfsp').returns(Promise.resolve({ isActive: true }))
      Participant.getByName.withArgs('payeefsp').returns(Promise.resolve(null))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant payeefsp not found'])
      test.end()
    })

    validatePrepareTest.test('fail validation for inactive participant', async (test) => {
      Participant.getByName.withArgs('testingtoolkitdfsp').returns(Promise.resolve({ isActive: true }))
      Participant.getByName.withArgs('payeefsp').returns(Promise.resolve({ isActive: false }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant payeefsp is inactive'])
      test.end()
    })

    validatePrepareTest.test('fail validation for invalid account', async (test) => {
      Participant.getByName.withArgs('testingtoolkitdfsp').returns(Promise.resolve({ isActive: true }))
      Participant.getByName.withArgs('payeefsp').returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('testingtoolkitdfsp', 'USD', Enum.Accounts.LedgerAccountType.POSITION).returns(Promise.resolve({ currencyIsActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('payeefsp', 'USD', Enum.Accounts.LedgerAccountType.POSITION).returns(Promise.resolve(null))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant payeefsp USD account not found'])
      test.end()
    })

    validatePrepareTest.test('fail validation for inactive account', async (test) => {
      Participant.getByName.withArgs('testingtoolkitdfsp').returns(Promise.resolve({ isActive: true }))
      Participant.getByName.withArgs('payeefsp').returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('testingtoolkitdfsp', 'USD', Enum.Accounts.LedgerAccountType.POSITION).returns(Promise.resolve({ currencyIsActive: true }))
      Participant.getAccountByNameAndCurrency.withArgs('payeefsp', 'USD', Enum.Accounts.LedgerAccountType.POSITION).returns(Promise.resolve({ currencyIsActive: false }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant payeefsp USD account is inactive'])
      test.end()
    })

    validatePrepareTest.test('fail validation decimal currency exceeding 4 maximum digits', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.amount.amount = '123.12345'

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Amount 123.12345 exceeds allowed scale of 4'])
      test.end()
    })

    validatePrepareTest.test('fail validation for same payer and payee', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.payeeFsp = payload.payerFsp

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Payer FSP and Payee FSP should be different, unless on-us tranfers are allowed by the Scheme'])
      test.end()
    })

    validatePrepareTest.test('fail validation for amounts containing more than 18 digits', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)
      payload.amount.amount = '123456789012345.6789'

      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Amount 123456789012345.6789 exceeds allowed precision of 18'])
      test.end()
    })

    validatePrepareTest.test('validate ilppacket with correct corresponding transfer request', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, true, 'Ilp packet should be valid')
      test.end()
    })

    validatePrepareTest.test('fail when ilp packet payee does not match transfer', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      payload.payeeFsp = 'INCORRECTdfsp'
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false, 'Ilp packet should not be valid')
      test.deepEqual(reasons, ['Ilp packet is not valid against transfer request'])
      test.end()
    })

    validatePrepareTest.test('fail when ilp packet payer does not match transfer', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      payload.payerFsp = 'INCORRECTdfsp'
      headers['fspiop-source'] = 'INCORRECTdfsp'
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false, 'Ilp packet should not be valid')
      test.deepEqual(reasons, ['Ilp packet is not valid against transfer request'])
      test.end()
    })

    validatePrepareTest.test('fail when ilp packet amount.amount does not match transfer', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      payload.amount.amount = '101'
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false, 'Ilp packet should not be valid')
      test.deepEqual(reasons, ['Ilp packet is not valid against transfer request'])
      test.end()
    })

    validatePrepareTest.test('fail when ilp packet amount.currency does not match transfer', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      payload.amount.currency = 'EEE'
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false, 'Ilp packet should not be valid')
      test.deepEqual(reasons, ['Ilp packet is not valid against transfer request'])
      test.end()
    })

    validatePrepareTest.test('fail when ilp packet is unabled to be decoded', async (test) => {
      Participant.getByName.returns(Promise.resolve({ isActive: true }))
      Participant.getAccountByNameAndCurrency.returns(Promise.resolve({ currencyIsActive: true }))
      CryptoConditions.validateCondition.returns(true)

      payload.ilpPacket = 'INVALID_AYIDGQAAAAAAACcQHWcucGF'
      const { validationPassed, reasons } = await Validator.validatePrepare(payload, headers)
      test.equal(validationPassed, false, 'Ilp packet should not be valid')
      test.deepEqual(reasons, ['Ilp packet was unable to be decoded and is invalid'])
      test.end()
    })
    validatePrepareTest.end()
  })

  validatorTest.test('validateById should', validateByIdTest => {
    validateByIdTest.test('pass validation for valid payload', async (test) => {
      Participant.getById.returns(Promise.resolve({}))
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
      Participant.getById.withArgs('testingtoolkitdfsp').returns(Promise.resolve({}))
      Participant.getById.withArgs('payeefsp').returns(Promise.resolve(null))
      CryptoConditions.validateCondition.returns(true)

      const { validationPassed, reasons } = await Validator.validateById(payload)
      test.equal(validationPassed, false)
      test.deepEqual(reasons, ['Participant payeefsp not found'])
      test.end()
    })

    validateByIdTest.end()
  })

  validatorTest.test('validateFulfilCondition should', validateFulfilConditionTest => {
    validateFulfilConditionTest.test('validated fulfilment against condition', async (test) => {
      const fulfilment = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF-'
      const condition = 'aAGyvOxOr4yvZo3TalJwvhdWelZp5JNC0MRqwK4DXQI'
      const result = Validator.validateFulfilCondition(fulfilment, condition)
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
      Transfer.getTransferParticipant.withArgs(participantName, transferId).returns(Promise.resolve([1]))

      const result = await Validator.validateParticipantTransferId(participantName, transferId)
      test.equal(result, true, 'results match')
      test.end()
    })

    validateParticipantTransferIdTest.test('validate the transfer id belongs to the requesting fsp return false for no match', async (test) => {
      const participantName = 'fsp1'
      const transferId = '88416f4c-68a3-4819-b8e0-c23b27267cd5'
      const ledgerAccountTypeId = 1
      Transfer.getTransferParticipant.withArgs(participantName, ledgerAccountTypeId, transferId).returns(Promise.resolve([]))

      const result = await Validator.validateParticipantTransferId(participantName, transferId)
      test.equal(result, false, 'results match')
      test.end()
    })

    validateParticipantTransferIdTest.end()
  })

  validatorTest.end()
})
