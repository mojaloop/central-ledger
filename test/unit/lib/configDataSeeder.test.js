/*****
 Test that integrated enumsCached.js and cache.js work together as expected.

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

 * Roman Pietrzak <roman.pietrzak@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const ConfigDataSeeder = require('../../../src/lib/configDataSeeder')
const SettlementService = require('../../../src/domain/settlement')
const SettlementModel = require('../../../src/models/settlement/settlementModel')
const Db = require('../../../src/lib/db')
const ConfigValidator = require('../../../src/lib/configValidator')

const Config = require('../../../src/lib/config')

Test('ConfigDataSeeder', async (configDataSeederTest) => {
  let sandbox
  let knexStub
  let trxStub
  let trxSpyRollBack
  let trxSpyCommit
  configDataSeederTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    knexStub = sandbox.stub()
    trxStub = {
      get commit () {

      },
      get rollback () {

      }
    }
    trxSpyCommit = sandbox.spy(trxStub, 'commit', ['get'])
    trxSpyRollBack = sandbox.spy(trxStub, 'rollback', ['get'])

    // sandbox.stub(LedgerAccountTypeModel)
    sandbox.stub(Db)
    sandbox.stub(SettlementService)
    sandbox.stub(SettlementModel)
    sandbox.stub(ConfigValidator)
    // sandbox.stub(LedgerAccountTypesService)
    Db.getKnex.returns(knexStub)
    knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
    t.end()
  })

  configDataSeederTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await configDataSeederTest.test('initializeSeedData when everything is ok', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['CGS', 'DEFERREDNET']
      SettlementModel.getSettlementModelsByName.resolves([])
      SettlementService.createSettlementModel.resolves()

      await ConfigDataSeeder.initializeSeedData()

      assert.equal(SettlementModel.getSettlementModelsByName.callCount, 1, 'should call the model getSettlementModelsByName function')
      assert.deepEqual(SettlementModel.getSettlementModelsByName.lastCall.args[0], ['CGS', 'DEFERREDNET'], 'should call the model getSettlementModelsByName with the right arguments')
      assert.equal(SettlementModel.getSettlementModelsByName.lastCall.args[1], trxStub, 'should call getSettlementModelsByName  the right argument: trx')

      assert.equal(SettlementService.createSettlementModel.callCount, 2, 'should call the model createSettlementModel function')
      assert.deepEqual(SettlementService.createSettlementModel.firstCall.args[0], {
        name: 'CGS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        autoPositionReset: false,
        settlementAccountType: 'SETTLEMENT'
      }, 'should call the model createSettlementModel with the right arguments')
      assert.equal(SettlementService.createSettlementModel.firstCall.args[1], trxStub, 'should call createSettlementModel  the right argument: trx')

      assert.deepEqual(SettlementService.createSettlementModel.secondCall.args[0], {
        name: 'DEFERREDNET',
        settlementGranularity: 'NET',
        settlementInterchange: 'MULTILATERAL',
        settlementDelay: 'DEFERRED',
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        autoPositionReset: true,
        settlementAccountType: 'SETTLEMENT'
      }, 'should call the model createSettlementModel with the right arguments')
      assert.equal(SettlementService.createSettlementModel.secondCall.args[1], trxStub, 'should call createSettlementModel  the right argument: trx')
      assert.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')

      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await configDataSeederTest.test('initializeSeedData when an existing ledgerAccount exist but some are missing', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['CGS']
      SettlementModel.getSettlementModelsByName.resolves([{ name: 'DEFERREDNET' }])
      SettlementService.createSettlementModel.resolves()

      await ConfigDataSeeder.initializeSeedData()
      assert.equal(SettlementModel.getSettlementModelsByName.callCount, 1, 'should call the model getSettlementModelsByName function')
      assert.deepEqual(SettlementModel.getSettlementModelsByName.lastCall.args[0], ['CGS'], 'should call the model getSettlementModelsByName with the right arguments')
      assert.equal(SettlementModel.getSettlementModelsByName.lastCall.args[1], trxStub, 'should call getSettlementModelsByName  the right argument: trx')

      assert.equal(SettlementService.createSettlementModel.callCount, 1, 'should call the model createSettlementModel function')
      assert.deepEqual(SettlementService.createSettlementModel.firstCall.args[0], {
        name: 'CGS',
        settlementGranularity: 'GROSS',
        settlementInterchange: 'BILATERAL',
        settlementDelay: 'IMMEDIATE',
        requireLiquidityCheck: true,
        ledgerAccountType: 'POSITION',
        autoPositionReset: false,
        settlementAccountType: 'SETTLEMENT'
      }, 'should call the model createSettlementModel with the right arguments')
      assert.equal(SettlementService.createSettlementModel.firstCall.args[1], trxStub, 'should call createSettlementModel  the right argument: trx')
      assert.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')

      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await configDataSeederTest.test('initializeSeedData when existing ledgerAccounts exist but none are missing', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['CGS']

      SettlementModel.getSettlementModelsByName.resolves([{ name: 'DEFERREDNET' }, { name: 'CGS' }])
      SettlementService.createSettlementModel.resolves()
      await ConfigDataSeeder.initializeSeedData()

      assert.equal(SettlementModel.getSettlementModelsByName.callCount, 1, 'should call the model getSettlementModelsByName function')
      assert.deepEqual(SettlementModel.getSettlementModelsByName.lastCall.args[0], ['CGS'], 'should call the model getSettlementModelsByName with the right arguments')
      assert.equal(SettlementModel.getSettlementModelsByName.lastCall.args[1], trxStub, 'should call getSettlementModelsByName  the right argument: trx')

      assert.equal(SettlementService.createSettlementModel.callCount, 0, 'should not call the model createSettlementModel function')
      assert.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')

      assert.end()
    } catch (err) {
      assert.fail(`Error thrown ${err}`, 'should have not thrown an error')
      assert.end()
    }
  })

  await configDataSeederTest.test('initializeSeedData when an error occurs', async (assert) => {
    try {
      Config.SETTLEMENT_MODELS = ['CGS']
      SettlementModel.getSettlementModelsByName.rejects(new Error())

      await ConfigDataSeeder.initializeSeedData()
      assert.fail()
    } catch (err) {
      assert.equal(trxSpyRollBack.get.calledOnce, true, 'rollback the transaction')
      assert.end()
    }
  })

  await configDataSeederTest.end()
})
