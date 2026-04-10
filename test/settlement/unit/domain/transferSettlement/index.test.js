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

 * Deon Botha <deon.botha@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const { logger } = require('../../../../../src/settlement/shared/logger')
const TransferFulfilService = require('../../../../../src/settlement/domain/transferSettlement')
const TransferFulfilModel = require('../../../../../src/settlement/models/transferSettlement')

Test('TransferSettlementService', async (transferSettlementServiceTest) => {
  let sandbox

  transferSettlementServiceTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(logger, 'isDebugEnabled').value(true)
    sandbox.stub(logger, 'debug')
    test.end()
  })

  transferSettlementServiceTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  const transferEventId = '154cbf04-bac7-444d-aa66-76f66126d7f5'

  await transferSettlementServiceTest.test('processMsgFulfil should', async processFulfilTest => {
    const transferEventStateStatus = 'error'

    await processFulfilTest.test('process a fulfil message', async test => {
      try {
        TransferFulfilModel.updateStateChange = sandbox.stub().returns()
        TransferFulfilModel.getSettlementModelByTransferId = sandbox.stub().returns([{ name: 'CGS' }])
        await TransferFulfilService.processMsgFulfil(transferEventId, transferEventStateStatus)
        test.ok(TransferFulfilModel.updateStateChange.withArgs(transferEventId, transferEventStateStatus).calledOnce, 'TransferFulfilModel.updateStateChange with args ... called once')
        test.end()
      } catch (err) {
        logger.error(`processFulfilTest failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await processFulfilTest.test('process a fulfil message with no matching settlement model', async test => {
      try {
        TransferFulfilModel.updateStateChange = sandbox.stub().returns()
        TransferFulfilModel.getSettlementModelByTransferId = sandbox.stub().returns([])
        await TransferFulfilService.processMsgFulfil(transferEventId, transferEventStateStatus)
        test.ok(TransferFulfilModel.updateStateChange.notCalled, 'TransferFulfilModel.updateStateChange is not called')
        test.end()
      } catch (err) {
        logger.error(`processFulfilTest failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await processFulfilTest.test('throw an exception', async test => {
      try {
        TransferFulfilModel.updateStateChange = sandbox.stub().throws(new Error('Error occurred'))
        TransferFulfilModel.getSettlementModelByTransferId = sandbox.stub().returns([{ name: 'CGS' }])
        await TransferFulfilService.processMsgFulfil(transferEventId, transferEventStateStatus)
        test.fail()
        test.end()
      } catch (err) {
        logger.error(`processFulfilTest failed with error - ${err}`)
        test.pass()
        test.end()
      }
    })
    await processFulfilTest.end()
  })

  await transferSettlementServiceTest.end()
})
