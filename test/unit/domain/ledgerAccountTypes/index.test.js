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
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const LedgerAccountTypeModel = require('../../../../src/models/ledgerAccountType/ledgerAccountType')

const LedgerAccountTypeService = require('../../../../src/domain/ledgerAccountTypes/index')

Test('LedgerAccountTypeService', async (ledgerAccountTypeServiceTest) => {
  let sandbox

  ledgerAccountTypeServiceTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(LedgerAccountTypeModel)
    t.end()
  })

  ledgerAccountTypeServiceTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await ledgerAccountTypeServiceTest.test('create when everything is ok', async (assert) => {
    try {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true,
        createdDate: '2018-10-11T11:45:00.000Z'
      }
      const ledgerAccountTypeId = 127
      LedgerAccountTypeModel.create.resolves(ledgerAccountTypeId)

      const expected = await LedgerAccountTypeService.create(payload.name, payload.description, payload.isActive, payload.isSettleable)
      assert.equal(LedgerAccountTypeModel.create.callCount, 1, 'should call the model create function')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[0], payload.name, 'should call the model with the right argument: name')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[1], payload.description, 'should call the model with the right argument: description')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[2], payload.isActive, 'should call the model with the right argument: isActive')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[3], payload.isSettleable, 'should call the model with the right argument: isSettleable')
      assert.equal(expected, true, 'should return true')
      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('create when default arguments are not passed', async (assert) => {
    try {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: false,
        isSettleable: false,
        createdDate: '2018-10-11T11:45:00.000Z'
      }
      LedgerAccountTypeModel.create.resolves(payload)
      const expected = await LedgerAccountTypeService.create(payload.name, payload.description)
      assert.equal(LedgerAccountTypeModel.create.callCount, 1, 'should call the model create function')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[0], payload.name, 'should call the model with the right argument: name')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[1], payload.description, 'should call the model with the right argument: description')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[2], false, 'should call the model with the right default argument: isActive: false')
      assert.equal(LedgerAccountTypeModel.create.lastCall.args[3], false, 'should call the model with the right default argument: isSettleable: false')
      assert.equal(expected, true, 'should return true')
      assert.end()
    } catch (err) {
      assert.fail('Error thrown', 'should have not thrown an error')
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('create when LedgerAccountTypeModel service fails', async (assert) => {
    try {
      const payload = {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true
      }
      LedgerAccountTypeModel.create.throws(new Error())
      await LedgerAccountTypeService.create(payload.name, payload.description, payload.isActive, payload.isSettleable)
      assert.fail('Error not thrown', 'should have thrown an error')
      assert.end()
    } catch (err) {
      assert.equal(LedgerAccountTypeModel.create.callCount, 1, 'should call the model create function')
      assert.ok(err instanceof Error, 'should throw an error')
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('getAll should return all ledgerAccountTypes model', async (assert) => {
    const payload = [
      {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account type for interchange fees',
        isActive: true,
        isSettleable: true,
        createdDate: '2018-10-11T11:45:00.000Z'
      },
      {
        name: 'INTERCHANGE_FEE_2_SETTLEMENT',
        description: 'settlement account type for interchange fees type 2',
        isActive: true,
        isSettleable: true,
        createdDate: '2018-10-11T12:45:00.000Z'
      }
    ]

    try {
      LedgerAccountTypeModel.getAll.resolves(payload)
      const result = await LedgerAccountTypeService.getAll()
      assert.deepEqual(result, payload, 'should return an array of ledger Account types models')
      assert.equal(LedgerAccountTypeModel.getAll.callCount, 1, 'should call the model getAll function')
      assert.equal(LedgerAccountTypeModel.getAll.lastCall.args[0], undefined, 'should call the model with getAll function with no parameters')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('getAll should throw an error if the LedgerAccountTypeModel service fails', async (assert) => {
    try {
      LedgerAccountTypeModel.getAll.rejects(new Error('Error message'))
      await LedgerAccountTypeService.getAll()
      assert.fail('Error not thrown', 'should have thrown an error')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, 'should throw an error')
      assert.ok(err.message, 'Error message', 'should throw the right error message')

      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('getByName should return one ledgerAccountTypes if found', async (assert) => {
    const payload = {
      name: 'INTERCHANGE_FEE_SETTLEMENT',
      description: 'settlement account type for interchange fees',
      isActive: true,
      isSettleable: true,
      createdDate: '2018-10-11T11:45:00.000Z'
    }
    try {
      LedgerAccountTypeModel.getLedgerAccountByName.resolves(payload)
      const result = await LedgerAccountTypeService.getByName(payload.name)
      assert.deepEqual(result, payload, 'should return one ledger Account type models')
      assert.equal(LedgerAccountTypeModel.getLedgerAccountByName.callCount, 1, 'should call the model getLedgerAccountByName function')
      assert.equal(LedgerAccountTypeModel.getLedgerAccountByName.lastCall.args[0], payload.name, 'should call the  model getLedgerAccountByName function with the name parameter')
      assert.end()
    } catch (err) {
      assert.fail(err instanceof Error, ` throws ${err} `)
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.test('getByName should throw an error if the LedgerAccountTypeModel service fails', async (assert) => {
    try {
      LedgerAccountTypeModel.getLedgerAccountByName.rejects(new Error('Error message'))

      await LedgerAccountTypeService.getByName('settlement')
      assert.fail('Error not thrown', 'should have thrown an error')
      assert.end()
    } catch (err) {
      assert.assert(err instanceof Error, 'should throw an error')
      assert.ok(err.message, 'Error message', 'should throw the right error message')
      assert.end()
    }
  })

  await ledgerAccountTypeServiceTest.end()
})
