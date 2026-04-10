/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Claudio Viola <claudio.viola@modusbox.com>

 --------------
 ******/

'use strict'

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const Transaction = require('../../../../src/settlement/domain/transactions/index')
const { logger } = require('../../../../src/settlement/shared/logger')
const scriptEngine = require('../../../../src/settlement/lib/scriptEngine')
const vm = require('vm')
const fs = require('fs')
const path = require('path')

const transferObjectMock = {
  transactionId: 'cb4c0f77-286d-40a5-8dfe-b162e64482ee',
  quoteId: 'ad1b4bea-32f4-4f48-a70d-7e13b28b453b',
  payee: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '27713813914',
      fspId: 'testfsp1',
      extensionList: {
        extension: [
          {
            key: 'accountType',
            value: 'Wallet'
          }
        ]
      }
    },
    personalInfo: {
      complexName: {
        firstName: 'testfsp1BankFname',
        lastName: 'testfsp1BankLname'
      },
      dateOfBirth: '1985-05-13'
    }
  },
  payer: {
    partyIdInfo: {
      partyIdType: 'MSISDN',
      partyIdentifier: '27713803912',
      fspId: 'payerfsp',
      extensionList: {
        extension: [
          {
            key: 'accountType',
            value: 'Wallet'
          }
        ]
      }
    },
    name: 'payerfspFname payerfspLname'
  },
  amount: {
    amount: '10',
    currency: 'TZS'
  },
  transactionType: {
    scenario: 'TRANSFER',
    initiator: 'PAYER',
    initiatorType: 'CONSUMER'
  }
}
const entityMock = [{
  transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321',
  value: 'AYIEGAAAAAAAAAXcHWcudGVzdGZzcDMubXNpc2RuLjI3NzEzODAzOTE2ggPuZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pWW1FeE1qSTNaVEF0WkdVNFl5MDBZemRtTFdFd09Ea3RaV1k1T0RoaU1XVmhaRFJsSWl3aWNYVnZkR1ZKWkNJNklqSTBOemxsWlRjeExXRXpZemd0TkRRMk5DMWhPVEF3TFdNMVpEVXpZamd4Wm1JNE1pSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpjM01UTTRNRE01TVRZaUxDSm1jM0JKWkNJNkluUmxjM1JtYzNBeklpd2laWGgwWlc1emFXOXVUR2x6ZENJNmV5SmxlSFJsYm5OcGIyNGlPbHQ3SW10bGVTSTZJbUZqWTI5MWJuUlVlWEJsSWl3aWRtRnNkV1VpT2lKWFlXeHNaWFFpZlYxOWZTd2ljR1Z5YzI5dVlXeEpibVp2SWpwN0ltTnZiWEJzWlhoT1lXMWxJanA3SW1acGNuTjBUbUZ0WlNJNkluUmxjM1JtYzNBelYyRnNiR1YwUm01aGJXVWlMQ0pzWVhOMFRtRnRaU0k2SW5SbGMzUm1jM0F6VjJGc2JHVjBURzVoYldVaWZTd2laR0YwWlU5bVFtbHlkR2dpT2lJeE9UZzFMVEExTFRFekluMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpJM056RXpPREF6T1RFMUlpd2labk53U1dRaU9pSjBaWE4wWm5Od01pSXNJbVY0ZEdWdWMybHZia3hwYzNRaU9uc2laWGgwWlc1emFXOXVJanBiZXlKclpYa2lPaUpoWTJOdmRXNTBWSGx3WlNJc0luWmhiSFZsSWpvaVYyRnNiR1YwSW4xZGZYMHNJbTVoYldVaU9pSjBaWE4wWm5Od01sZGhiR3hsZEVadVlXMWxJSFJsYzNSbWMzQXlWMkZzYkdWMFRHNWhiV1VpZlN3aVlXMXZkVzUwSWpwN0ltRnRiM1Z1ZENJNklqRTFJaXdpWTNWeWNtVnVZM2tpT2lKVVdsTWlmU3dpZEhKaGJuTmhZM1JwYjI1VWVYQmxJanA3SW5OalpXNWhjbWx2SWpvaVZGSkJUbE5HUlZJaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkRUMDVUVlUxRlVpSjlmUQA',
  createdDate: '2020-05-23T17:31:29.000Z'
}]

Test('Script Engine Execute Test', async (scriptEngineTest) => {
  let sandbox

  scriptEngineTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(logger)
    test.end()
  })

  scriptEngineTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await scriptEngineTest.test('should successfully execute', async (test) => {
    const transferId = '07785623-1d17-4231-b7fe-48bacaa05d58'
    const scriptSource = fs.readFileSync(path.resolve('./test/settlement/unit/data/interchangeCalculationTestScript.js'), 'utf8')
    const script = new vm.Script(scriptSource)
    const scriptSpy = sandbox.spy(script, 'runInNewContext')
    const payload = {
      id: transferId
    }
    const getByIdStub = sandbox.stub(Transaction, 'getById')
    getByIdStub.resolves(entityMock)
    const getTransactionObjectStub = sandbox.stub(Transaction, 'getTransactionObject')
    getTransactionObjectStub.resolves(transferObjectMock)
    const result = await scriptEngine.execute(script, payload)
    const scriptSpyLastCall = scriptSpy.lastCall
    test.deepEqual(getByIdStub.lastCall.args[0], payload.id, 'should find the transaction by transferId')
    test.deepEqual(getTransactionObjectStub.lastCall.args[0], entityMock[0].value, 'should get the transactionObject by its value')
    test.deepEqual(scriptSpyLastCall.args[0].payload, payload, 'should execute the script with given payload arguments')
    test.deepEqual(scriptSpyLastCall.args[0].transfer, transferObjectMock, 'should execute the script with found transaction')
    test.ok(typeof scriptSpyLastCall.args[0].log === 'function', 'should pass along a log function')
    test.ok(typeof scriptSpyLastCall.args[0].multiply === 'function', 'should pass along a multiply function')
    test.ok(typeof scriptSpyLastCall.args[0].getExtensionValue === 'function', 'should pass along a getExtensionValue function')
    test.ok(typeof scriptSpyLastCall.args[0].addLedgerEntry === 'function', 'should pass along a addLedgerEntry function')
    test.deepEqual(result, {
      ledgerEntries: [
        {
          transferId: payload.id,
          ledgerAccountTypeId: 'INTERCHANGE_FEE',
          ledgerEntryTypeId: 'INTERCHANGE_FEE',
          amount: '0.06',
          currency: transferObjectMock.amount.currency,
          payerFspId: transferObjectMock.payer.partyIdInfo.fspId,
          payeeFspId: transferObjectMock.payee.partyIdInfo.fspId
        }
      ]
    })

    test.end()
  })

  await scriptEngineTest.test('should throw if no transaction is found', async (test) => {
    const transferId = '07785623-1d17-4231-b7fe-48bacaa05d58'
    const script = {
      runInNewContext: sandbox.stub()
    }
    const payload = {
      id: transferId
    }
    const getByIdStub = sandbox.stub(Transaction, 'getById')
    getByIdStub.resolves(null)
    try {
      await scriptEngine.execute(script, payload)
      test.fail('Should have thrown an error!')
      test.end()
    } catch (err) {
      console.log(err.message)
      test.equal(err.message, `No records for transferId ${payload.id} was found`, 'should throw an error message if transaction is not found')
      test.equal(script.runInNewContext.getCalls.length, 0, 'should have not executed the script')
      test.end()
    }
  })

  await scriptEngineTest.end()
})
