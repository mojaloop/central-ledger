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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Logger = require('@mojaloop/central-services-logger')
const Model = require('../../../../src/models/transfer/transferFulfilmentDuplicateCheck')
const Db = require('../../../../src/lib/db')

Test('TransferFulfilmentDuplicateCheck model', async (TransferFulfilmentDuplicateCheckTest) => {
  let sandbox
  const existingHashes = [{
    transferId: '9136780b-37e2-457c-8c05-f15dbb033b10',
    hash: 'EE1H9SMsUlHDMOm0H4OfI4D57MHOVTYwwXBK+BWHr/4',
    createdDate: '2018-08-15 13:41:28'
  }]
  TransferFulfilmentDuplicateCheckTest.beforeEach(test => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    Db.transferFulfilmentDuplicateCheck = {
      findOne: sandbox.stub(),
      insert: sandbox.stub()
    }
    Db.from = (table) => {
      return Db[table]
    }
    test.end()
  })

  TransferFulfilmentDuplicateCheckTest.afterEach(test => {
    sandbox.restore()
    test.end()
  })

  await TransferFulfilmentDuplicateCheckTest.test('getTransferFulfilmentDuplicateCheck should', async (getTransferFulfilmentDuplicateCheckTest) => {
    await getTransferFulfilmentDuplicateCheckTest.test('get the transfer duplicate check hash', async test => {
      try {
        const { transferId } = existingHashes[0]
        Db.transferFulfilmentDuplicateCheck.findOne.withArgs({ transferId }).returns(existingHashes[0])
        const result = await Model.getTransferFulfilmentDuplicateCheck(transferId)
        test.deepEqual(result, existingHashes[0])
        test.end()
      } catch (err) {
        Logger.error(`getTransferFulfilmentDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await getTransferFulfilmentDuplicateCheckTest.test('throw error', async test => {
      try {
        const { transferId } = existingHashes[0]
        Db.transferFulfilmentDuplicateCheck.findOne.throws(new Error('message'))
        await Model.getTransferFulfilmentDuplicateCheck(transferId)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await getTransferFulfilmentDuplicateCheckTest.end()
  })

  await TransferFulfilmentDuplicateCheckTest.test('saveTransferFulfilmentDuplicateCheck should', async (saveTransferFulfilmentDuplicateCheckTest) => {
    await saveTransferFulfilmentDuplicateCheckTest.test('save the transfer duplicate check hash', async test => {
      try {
        Db.transferFulfilmentDuplicateCheck.insert.returns(1)
        const { transferId, hash } = existingHashes[0]
        const result = await Model.saveTransferFulfilmentDuplicateCheck(transferId, hash)
        test.equal(result, 1)
        test.end()
      } catch (err) {
        Logger.error(`saveTransferFulfilmentDuplicateCheck failed with error - ${err}`)
        test.fail()
        test.end()
      }
    })

    await saveTransferFulfilmentDuplicateCheckTest.test('throw error', async test => {
      try {
        Db.transferFulfilmentDuplicateCheck.insert.throws(new Error('message'))
        const { transferId, hash } = existingHashes[0]
        await Model.saveTransferFulfilmentDuplicateCheck(transferId, hash)
        test.fail(' should throw')
        test.end()
        test.end()
      } catch (err) {
        test.pass('Error thrown')
        test.end()
      }
    })

    await saveTransferFulfilmentDuplicateCheckTest.end()
  })

  await TransferFulfilmentDuplicateCheckTest.end()
})
