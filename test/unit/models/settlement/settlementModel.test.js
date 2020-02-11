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
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Logger = require('@mojaloop/central-services-logger')
const SettlementModelModel = require('../../../../src/models/settlement/settlementModel')

Test('Settlement model', async (settlementTest) => {
  const sandbox = Sinon.createSandbox()

  await settlementTest.test('create settlement model', async (assert) => {
    Db.settlementModel = {
      insert: sandbox.stub().returns(true),
      find: sandbox.stub()
    }
    try {
      const r = await SettlementModelModel.create({ name: 'DEFERRED_NET', settlementGranularityId: 2, settlementInterchangeId: 2, settlementDelayId: 2, ledgerAccountTypeId: 1 })
      assert.ok(r)
      assert.end()
    } catch (err) {
      Logger.error(`create settlement model failed with error - ${err}`)
      assert.pass('Error thrown')
      assert.end()
    }
  })

  await settlementTest.test('create settlement model should throw an error', async (assert) => {
    Db.settlementModel.insert.throws(new Error('message'))
    try {
      const r = await SettlementModelModel.create({ participantId: 1, currencyId: 'USD', createdBy: 'unknown' })
      assert.comment(r)
      assert.fail(' should throw')
    } catch (err) {
      assert.assert(err instanceof Error)
      Logger.error(`create settlement model failed with error - ${err}`)
      assert.pass('Error thrown')
    }
    assert.end()
  })

  await settlementTest.test('get settlement model', async (assert) => {
    try {
      Db.settlementModel.find.withArgs({ name: 'test' }).returns([
        {
          settlementModelId: 106,
          name: 'testingSevennnnN91',
          isActive: 1,
          settlementGranularityId: 1,
          settlementInterchangeId: 1,
          settlementDelayId: 2,
          currencyId: null,
          requireLiquidityCheck: 1,
          ledgerAccountTypeId: 6
        }])
      const expected = {
        settlementModelId: 106,
        name: 'testingSevennnnN91',
        isActive: 1,
        settlementGranularityId: 1,
        settlementInterchangeId: 1,
        settlementDelayId: 2,
        currencyId: null,
        requireLiquidityCheck: 1,
        ledgerAccountTypeId: 6
      }
      const result = await SettlementModelModel.getByName('test')
      assert.equal(JSON.stringify(result), JSON.stringify(expected))
      assert.end()
    } catch (err) {
      Logger.error(`get settlement model by name failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await settlementTest.test('get with empty name', async (assert) => {
    Db.settlementModel.find.withArgs({ name: '' }).throws(new Error())
    try {
      await SettlementModelModel.getByName('')
      assert.fail(' should throws with empty name ')
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
    }
    assert.end()
  })
  await settlementTest.end()
})
