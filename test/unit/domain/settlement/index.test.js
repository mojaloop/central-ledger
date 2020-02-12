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
const SettlementModel = require('../../../../src/models/settlement/settlementModel')
const LedgerAccountTypeModel = require('../../../../src/models/ledgerAccountType/ledgerAccountType')
const Logger = require('@mojaloop/central-services-logger')

const SettlementService = require('../../../../src/domain/settlement/index')

Test('SettlementModel SettlementService', async (settlementModelTest) => {
  let sandbox

  settlementModelTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(LedgerAccountTypeModel, 'getLedgerAccountByName')

    Db.settlementModel = {
      insert: sandbox.stub(),
      update: sandbox.stub(),
      findOne: sandbox.stub(),
      find: sandbox.stub(),
      destroy: sandbox.stub()
    }
    t.end()
  })

  settlementModelTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  const settlementModel = [

    {
      settlementModelId: 106,
      name: 'DEFERRED_NET',
      isActive: 1,
      settlementGranularityId: 1,
      settlementInterchangeId: 1,
      settlementDelayId: 2,
      currencyId: null,
      requireLiquidityCheck: 1,
      ledgerAccountTypeId: 6
    }
  ]

  await settlementModelTest.test('create settlement model', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'create')
      const expected = await SettlementService.createSettlementModel('IMMEDIATE_GROSS', true, 1, 1, 1, 'USD', true, 'POSITION', true)
      assert.equal(expected, true)
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await settlementModelTest.test('create settlement model should throw an error', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'create').throws(new Error())
      await SettlementService.createSettlementModel()
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })
  await settlementModelTest.test('getLedgerAccountType by name name should return ledgerAccountType', async (assert) => {
    const name = {
      currency: 'AFA',
      type: 'POSITION'
    }
    const ledgerAccountsMock = {
      ledgerAccountTypeId: 1,
      name: 'POSITION',
      description: 'Typical accounts from which a DFSP provisions  transfers',
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z'
    }

    try {
      LedgerAccountTypeModel.getLedgerAccountByName.withArgs(name.type).returns(ledgerAccountsMock)
      const expected = await SettlementService.getLedgerAccountTypeName(name.type)
      assert.deepEqual(expected, ledgerAccountsMock, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await settlementModelTest.test('getLedgerAccountType by name name should throw an error if the name is invalid', async (assert) => {
    const name = {
      currency: 'AFA',
      type: 'POSITION'
    }
    const ledgerAccountsMock = {
      ledgerAccountTypeId: 1,
      name: 'POSITION',
      description: 'Typical accounts from which a DFSP provisions  transfers',
      isActive: 1,
      createdDate: '2018-10-11T11:45:00.000Z'
    }

    try {
      LedgerAccountTypeModel.getLedgerAccountByName.withArgs(name.type).throws(new Error())
      const expected = await SettlementService.getLedgerAccountTypeName(name.type)
      assert.deepEqual(expected, ledgerAccountsMock, 'Results matched')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })
  await settlementModelTest.test('get settlement model by name', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getByName').returns(settlementModel)
      const expected = await SettlementService.getByName('test')
      assert.equal(expected, settlementModel)
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await settlementModelTest.test('get settlement model by name should throw an error', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getByName').throws(new Error())
      await SettlementService.getByName('test')
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })

  await settlementModelTest.test('getAll', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getAll').returns(settlementModel)
      const result = await SettlementService.getAll()
      assert.deepEqual(result, settlementModel)
      assert.end()
    } catch (err) {
      Logger.error(`get all settlement models failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await settlementModelTest.test('getAll', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getAll').throws(new Error())
      await SettlementService.getAll()
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })

  await settlementModelTest.test('update', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getByName').returns(settlementModel)
      sandbox.stub(SettlementModel, 'update').returns(settlementModel)
      const result = await SettlementService.update('DEFERRED_NET', { isActive: 1 })
      assert.deepEqual(result, settlementModel)
      assert.end()
    } catch (err) {
      Logger.error(`get all settlement models failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await settlementModelTest.test('update should throw an error', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getByName').throws(new Error())
      sandbox.stub(SettlementModel, 'update').returns(settlementModel)
      await SettlementService.update('DEFERRED_NET', { isActive: 1 })
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })
  await settlementModelTest.test('update should throw an error when settlement model does not exists', async (assert) => {
    try {
      sandbox.stub(SettlementModel, 'getByName').returns(false)
      sandbox.stub(SettlementModel, 'update').returns(settlementModel)
      await SettlementService.update('DEFERRED_NET', { isActive: 1 })
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error)
      assert.end()
    }
  })

  await settlementModelTest.end()
})
