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

 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const RulesService = require('../../../../../src/settlement/domain/rules')
const TransferSettlementModel = require('../../../../../src/settlement/models/transferSettlement')

Test('RulesService', async (rulesServiceTest) => {
  let sandbox
  sandbox = Sinon.createSandbox()

  rulesServiceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(logger, 'isDebugEnabled').value(true)
    sandbox.stub(logger, 'isErrorEnabled').value(true)
    sandbox.stub(logger, 'error')
    sandbox.stub(logger, 'debug')
    test.end()
  })

  rulesServiceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  const transferEventId = '154cbf04-bac7-444d-aa66-76f66126d7f5'

  await rulesServiceTest.test('insertLedgerEntries should', async ledgerEntriesTest => {
    const ledgerEntries = []

    await ledgerEntriesTest.test('insert ledger entries', async test => {
      try {
        TransferSettlementModel.insertLedgerEntries = sandbox.stub().returns()
        await RulesService.insertLedgerEntries(ledgerEntries, transferEventId)
        test.ok(TransferSettlementModel.insertLedgerEntries.withArgs(ledgerEntries, transferEventId).calledOnce, 'TransferSettlementModel.insertLedgerEntries with args ... called once')
        test.end()
      } catch (err) {
        test.fail()
        test.end()
      }
    })

    await ledgerEntriesTest.test('throw an exception', async test => {
      const error = new Error('Error occurred')
      try {
        TransferSettlementModel.insertLedgerEntries = sandbox.stub().throws(error)
        await RulesService.insertLedgerEntries(ledgerEntries, transferEventId)
        test.fail()
        test.end()
      } catch (err) {
        logger.error(`insertLedgerEntries failed with error - ${err}`)
        test.pass()
        test.end()
      }
    })
    await ledgerEntriesTest.end()
  })
  await rulesServiceTest.end()
})
