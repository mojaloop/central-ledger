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
const Db = require('../../../../src/lib/db')
const IlpPackets = require('../../../../src/models/ilpPackets/ilpPacket')

const TransactionsService = require('../../../../src/domain/transactions/index')

Test('Transactions Service', async (transactionsTest) => {
  let sandbox

  transactionsTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()

    Db.ilpPacket = {
      find: sandbox.stub()
    }
    t.end()
  })

  transactionsTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  const ilpPacket = {
    transferId: '6d3e964e-9a25-4ff5-a365-2cc5af348321',
    value: 'AYIC-AAAAAAAAeIfHWcucGF5ZWVmc3AubXNpc2RuLjIyNTU2OTk5MTI1ggLOZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTlRWa09ESXdObVV0T0RCaU55MDBPR00wTFRrNU5HTXRaREEyTmpRd01XRXdZbU00SWl3aWNYVnZkR1ZKWkNJNklqRmtPVGhpTkdReExXWmpOVFV0TkRaa09DMDROV1EyTFRnNVl6TXdZMkZoWWpRME5pSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpJMU5UWTVPVGt4TWpVaUxDSm1jM0JKWkNJNkluQmhlV1ZsWm5Od0luMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpJeU5UQTNNREE0TVRneElpd2labk53U1dRaU9pSndZWGxsY21aemNDSjlMQ0p3WlhKemIyNWhiRWx1Wm04aU9uc2lZMjl0Y0d4bGVFNWhiV1VpT25zaVptbHljM1JPWVcxbElqb2lUV0YwY3lJc0lteGhjM1JPWVcxbElqb2lTR0ZuYldGdUluMHNJbVJoZEdWUFprSnBjblJvSWpvaU1UazRNeTB4TUMweU5TSjlmU3dpWVcxdmRXNTBJanA3SW1OMWNuSmxibU41SWpvaVZWTkVJaXdpWVcxdmRXNTBJam94TWpNMExqSXpmU3dpZEhKaGJuTmhZM1JwYjI1VWVYQmxJanA3SW5OalpXNWhjbWx2SWpvaVZGSkJUbE5HUlZJaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkRUMDVUVlUxRlVpSjlmUQA',
    createdDate: '2020-05-23T17:31:29.000Z'
  }
  const base64Value = 'AYIC-AAAAAAAAeIfHWcucGF5ZWVmc3AubXNpc2RuLjIyNTU2OTk5MTI1ggLOZXlKMGNtRnVjMkZqZEdsdmJrbGtJam9pTlRWa09ESXdObVV0T0RCaU55MDBPR00wTFRrNU5HTXRaREEyTmpRd01XRXdZbU00SWl3aWNYVnZkR1ZKWkNJNklqRmtPVGhpTkdReExXWmpOVFV0TkRaa09DMDROV1EyTFRnNVl6TXdZMkZoWWpRME5pSXNJbkJoZVdWbElqcDdJbkJoY25SNVNXUkpibVp2SWpwN0luQmhjblI1U1dSVWVYQmxJam9pVFZOSlUwUk9JaXdpY0dGeWRIbEpaR1Z1ZEdsbWFXVnlJam9pTWpJMU5UWTVPVGt4TWpVaUxDSm1jM0JKWkNJNkluQmhlV1ZsWm5Od0luMTlMQ0p3WVhsbGNpSTZleUp3WVhKMGVVbGtTVzVtYnlJNmV5SndZWEowZVVsa1ZIbHdaU0k2SWsxVFNWTkVUaUlzSW5CaGNuUjVTV1JsYm5ScFptbGxjaUk2SWpJeU5UQTNNREE0TVRneElpd2labk53U1dRaU9pSndZWGxsY21aemNDSjlMQ0p3WlhKemIyNWhiRWx1Wm04aU9uc2lZMjl0Y0d4bGVFNWhiV1VpT25zaVptbHljM1JPWVcxbElqb2lUV0YwY3lJc0lteGhjM1JPWVcxbElqb2lTR0ZuYldGdUluMHNJbVJoZEdWUFprSnBjblJvSWpvaU1UazRNeTB4TUMweU5TSjlmU3dpWVcxdmRXNTBJanA3SW1OMWNuSmxibU41SWpvaVZWTkVJaXdpWVcxdmRXNTBJam94TWpNMExqSXpmU3dpZEhKaGJuTmhZM1JwYjI1VWVYQmxJanA3SW5OalpXNWhjbWx2SWpvaVZGSkJUbE5HUlZJaUxDSnBibWwwYVdGMGIzSWlPaUpRUVZsRlVpSXNJbWx1YVhScFlYUnZjbFI1Y0dVaU9pSkRUMDVUVlUxRlVpSjlmUQA=='
  const transactionObject = {
    transactionId: '55d8206e-80b7-48c4-994c-d066401a0bc8',
    quoteId: '1d98b4d1-fc55-46d8-85d6-89c30caab446',
    payee: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '22556999125',
        fspId: 'payeefsp'
      }
    },
    payer: {
      partyIdInfo: {
        partyIdType: 'MSISDN',
        partyIdentifier: '22507008181',
        fspId: 'payerfsp'
      },
      personalInfo: {
        complexName: {
          firstName: 'Mats',
          lastName: 'Hagman'
        },
        dateOfBirth: '1983-10-25'
      }
    },
    amount: {
      currency: 'USD',
      amount: 1234.23
    },
    transactionType: {
      scenario: 'TRANSFER',
      initiator: 'PAYER',
      initiatorType: 'CONSUMER'
    }
  }

  await transactionsTest.test('get ilpPacket object by transfer id', async (assert) => {
    try {
      sandbox.stub(IlpPackets, 'getById').returns(ilpPacket)
      const expected = await TransactionsService.getById('6d3e964e-9a25-4ff5-a365-2cc5af348321')
      assert.equal(expected, ilpPacket)
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await transactionsTest.test('get ilpPacket by transfer id should throw an error', async (assert) => {
    try {
      sandbox.stub(IlpPackets, 'getById').throws(new Error())
      await TransactionsService.getById('6d3e964e-9a25-4ff5-a365-2cc5af348321')
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })

  await transactionsTest.test('get transaction object by transfer id', async (assert) => {
    try {
      const expected = await TransactionsService.getTransactionObject(base64Value)
      assert.deepEqual(expected, transactionObject)
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await transactionsTest.end()
})
