/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * ModusBox
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Handler = require('../../../../src/api/transactions/handler')
const TransactionsService = require('../../../../src/domain/transactions')

Test('IlpPackets', IlpPacketsHandlerTest => {
  let sandbox
  const ilpPacket = [{
    transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321',
    value: 'AQAAAAAAAADIEHByaXZhdGUucGF5ZWVmc3CCAiB7InRyYW5zYWN0aW9uSWQiOiIyZGY3NzRlMi1mMWRiLTRmZjctYTQ5NS0yZGRkMzdhZjdjMmMiLCJxdW90ZUlkIjoiMDNhNjA1NTAtNmYyZi00NTU2LThlMDQtMDcwM2UzOWI4N2ZmIiwicGF5ZWUiOnsicGFydHlJZEluZm8iOnsicGFydHlJZFR5cGUiOiJNU0lTRE4iLCJwYXJ0eUlkZW50aWZpZXIiOiIyNzcxMzgwMzkxMyIsImZzcElkIjoicGF5ZWVmc3AifSwicGVyc29uYWxJbmZvIjp7ImNvbXBsZXhOYW1lIjp7fX19LCJwYXllciI6eyJwYXJ0eUlkSW5mbyI6eyJwYXJ0eUlkVHlwZSI6Ik1TSVNETiIsInBhcnR5SWRlbnRpZmllciI6IjI3NzEzODAzOTExIiwiZnNwSWQiOiJwYXllcmZzcCJ9LCJwZXJzb25hbEluZm8iOnsiY29tcGxleE5hbWUiOnt9fX0sImFtb3VudCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6IjIwMCJ9LCJ0cmFuc2FjdGlvblR5cGUiOnsic2NlbmFyaW8iOiJERVBPU0lUIiwic3ViU2NlbmFyaW8iOiJERVBPU0lUIiwiaW5pdGlhdG9yIjoiUEFZRVIiLCJpbml0aWF0b3JUeXBlIjoiQ09OU1VNRVIiLCJyZWZ1bmRJbmZvIjp7fX19',
    createdDate: '2020-05-23T17:31:29.000Z'
  }]
  const transferObject = {
    transactionId: '2df774e2-f1db-4ff7-a495-2ddd37af7c2c',
    quoteId: '03a60550-6f2f-4556-8e04-0703e39b87ff',
    payee: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '27713803913',
        fspId: 'payeefsp'
      },
      personalInfo: {
        complexName: {}
      }
    },
    payer: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '27713803911',
        fspId: 'payerfsp'
      },
      personalInfo: {
        complexName: {}
      }
    },
    amount: {
      currency: 'USD',
      amount: '200'
    },
    transactionType: {
      scenario: 'DEPOSIT',
      subScenario: 'DEPOSIT',
      initiator: 'PAYER',
      initiatorType: 'CONSUMER',
      refundInfo: {}
    }
  }
  IlpPacketsHandlerTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(TransactionsService)
    test.end()
  })

  IlpPacketsHandlerTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })
  IlpPacketsHandlerTest.test('Handler Test', async handlerTest => {
    handlerTest.test('getById should return ilpPacket for the transfer Id', async function (test) {
      TransactionsService.getById.returns(Promise.resolve(ilpPacket))
      TransactionsService.getTransactionObject.returns(Promise.resolve(transferObject))
      const result = await Handler.getById({ params: { id: ilpPacket[0].transferId } })
      test.deepEqual(result, transferObject, 'The results match')
      test.end()
    })

    handlerTest.test('getByName should throw error', async function (test) {
      TransactionsService.getById.withArgs(ilpPacket[0].transferId).returns(Promise.resolve(null))
      try {
        await Handler.getById({ params: { id: ilpPacket[0].transferId } })
      } catch (e) {
        test.ok(e instanceof Error)
        test.equal(e.message, 'The requested resource could not be found.')
        test.end()
      }
    })

    handlerTest.end()
  })

  IlpPacketsHandlerTest.end()
})
