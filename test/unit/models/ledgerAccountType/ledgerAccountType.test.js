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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')

const Model = require('../../../../src/models/ledgerAccountType/ledgerAccountType')
const participantCurrencyModel = require('../../../../src/models/participant/participantCurrency')

Test('ledgerAccountType model', async (ledgerAccountTypeTest) => {
  let sandbox

  const ledgerAccountType = {
    name: 'POSITION',
    description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
    isActive: 1,
    createdDate: new Date()
  }

  const participantCurrency = {
    participantId: 1,
    currencyId: 'USD',
    ledgerAccountTypeId: 2,
    isActive: 1,
    createdBy: 'unknown',
    createdDate: '2018-10-23 14:17:07'
  }

  const accountParams = {
    participantId: participantCurrency.participantId,
    currencyId: 'USD',
    ledgerAccountTypeId: ledgerAccountType.ledgerAccountTypeId,
    isActive: 1
  }

  const name = {
    name: 'POSITION'
  }

  ledgerAccountTypeTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    Db.ledgerAccountType = {
      findOne: sandbox.stub(),
      destroy: sandbox.stub(),
      insert: sandbox.stub(),
      find: sandbox.stub()
    }

    Db.participantCurrency = {
      findOne: sandbox.stub(),
      destroy: sandbox.stub()
    }

    Db.from = (table) => {
      return Db[table]
    }

    t.end()
  })

  ledgerAccountTypeTest.afterEach(t => {
    sandbox.restore()

    t.end()
  })

  await ledgerAccountTypeTest.test('get a ledger account type', async (assert) => {
    try {
      Db.participantCurrency.findOne.withArgs(accountParams).returns(participantCurrency)
      const result = await participantCurrencyModel.getByName(accountParams)
      assert.equal(JSON.stringify(result), JSON.stringify(participantCurrency))
      assert.end()
    } catch (err) {
      assert.fail(err)
      assert.end()
    }
  })

  await ledgerAccountTypeTest.test('get a ledger account type throws error', async (assert) => {
    try {
      Db.participantCurrency.findOne.withArgs(accountParams).throws(new Error())
      await participantCurrencyModel.getByName(accountParams)
      assert.fail('Error not thrown')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error, 'Error is thrown')
      assert.end()
    }
  })

  await ledgerAccountTypeTest.test('Error is thrown on a invalid ledger account name', async (assert) => {
    try {
      Db.ledgerAccountType.findOne.throws(new Error())
      await Model.getLedgerAccountByName(name)
      assert.fail('Error should be caught')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error, 'Error is thrown')
      assert.end()
    }
  })

  await ledgerAccountTypeTest.test('create should', async (test) => {
    const ledgerAccountType = {
      name: 'POSITION',
      description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
      isActive: 1,
      isSettleable: true
    }
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = sandbox.stub()
      trxStub.commit = sandbox.stub()
      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const insertStub = sandbox.stub()
      transactingStub.resolves()
      insertStub.returns({ transacting: transactingStub })
      knexStub.returns({ insert: insertStub })
      const selectStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const expectedRecords = [
        {
          ledgerAccountTypeId: 100
        }
      ]
      transactingStub.resolves(expectedRecords)
      whereStub.returns({ transacting: transactingStub })
      fromStub.returns({ where: whereStub })
      selectStub.returns({ from: fromStub })
      knexStub.select = selectStub

      const result = await Model.create(ledgerAccountType.name, ledgerAccountType.description, ledgerAccountType.isActive, ledgerAccountType.isSettleable, trxStub)
      test.deepEqual(result, expectedRecords[0].ledgerAccountTypeId, 'return the created record id')
      test.equal(insertStub.callCount, 1, 'call insert')
      test.deepEqual(insertStub.lastCall.args[0], ledgerAccountType, 'pass the payload arguments to insert call')
      test.equal(selectStub.callCount, 1, 'retrieve the created record')
      test.equal(transactingStub.callCount, 2, 'make the database calls as transaction')
      test.equal(transactingStub.lastCall.args[0], trxStub, 'run as transaction')
      test.equal(trxStub.commit.callCount, 0, 'not commit the transaction if transaction is passed')
      test.end()
    } catch (err) {
      console.log(err)
      test.fail(`should have not throw an error ${err}`)
      test.end()
    }
  })

  await ledgerAccountTypeTest.test('create should', async (test) => {
    const ledgerAccountType = {
      name: 'POSITION',
      description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
      isActive: 1,
      isSettleable: true
    }
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      const trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      const trxSpyCommit = sandbox.spy(trxStub, 'commit', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const insertStub = sandbox.stub()
      transactingStub.resolves()
      insertStub.returns({ transacting: transactingStub })
      knexStub.returns({ insert: insertStub })

      const selectStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const whereStub = sandbox.stub()
      const expectedRecords = [
        {
          ledgerAccountTypeId: 100
        }
      ]
      transactingStub.resolves(expectedRecords)
      whereStub.returns({ transacting: transactingStub })
      fromStub.returns({ where: whereStub })
      selectStub.returns({ from: fromStub })
      knexStub.select = selectStub

      await Model.create(ledgerAccountType.name, ledgerAccountType.description, ledgerAccountType.isActive, ledgerAccountType.isSettleable)
      test.equal(trxSpyCommit.get.calledOnce, true, 'commit the transaction if no transaction is passed')
      test.end()
    } catch (err) {
      test.fail(`should not have thrown an error ${err}`)
      test.end()
    }
  })
  await ledgerAccountTypeTest.test('create should', async (test) => {
    let trxStub
    let trxSpyRollBack
    const ledgerAccountType = {
      name: 'POSITION',
      description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
      isActive: 1,
      isSettleable: true
    }
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      trxSpyRollBack = sandbox.spy(trxStub, 'rollback', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const insertStub = sandbox.stub()
      transactingStub.resolves()
      knexStub.insert = insertStub.returns({ transacting: transactingStub })
      const selectStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const whereStub = sandbox.stub()
      transactingStub.rejects(new Error())
      whereStub.returns({ transacting: transactingStub })
      fromStub.returns({ whereStub: whereStub })
      knexStub.select = selectStub.returns({ from: fromStub })

      await Model.create(ledgerAccountType.name, ledgerAccountType.description, ledgerAccountType.isActive, ledgerAccountType.isSettleable)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.equal(trxSpyRollBack.get.calledOnce, true, 'rollback the transaction if no transaction is passed')
      test.end()
    }
  })

  await ledgerAccountTypeTest.test('create should', async (test) => {
    let trxStub
    let trxSpyRollBack

    const ledgerAccountType = {
      name: 'POSITION',
      description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
      isActive: 1,
      isSettleable: true
    }
    try {
      sandbox.stub(Db, 'getKnex')
      const knexStub = sandbox.stub()
      trxStub = {
        get commit () {

        },
        get rollback () {

        }
      }
      trxSpyRollBack = sandbox.spy(trxStub, 'rollback', ['get'])

      knexStub.transaction = sandbox.stub().callsArgWith(0, trxStub)
      Db.getKnex.returns(knexStub)
      const transactingStub = sandbox.stub()
      const insertStub = sandbox.stub()
      transactingStub.resolves()
      knexStub.insert = insertStub.returns({ transacting: transactingStub })
      const selectStub = sandbox.stub()
      const fromStub = sandbox.stub()
      const whereStub = sandbox.stub()
      transactingStub.rejects(new Error())
      whereStub.returns({ transacting: transactingStub })
      fromStub.returns({ whereStub: whereStub })
      knexStub.select = selectStub.returns({ from: fromStub })

      await Model.create(ledgerAccountType.name, ledgerAccountType.description, ledgerAccountType.isActive, ledgerAccountType.isSettleable, trxStub)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.equal(trxSpyRollBack.get.calledOnce, false, 'not rollback the transaction if transaction is passed')
      test.end()
    }
  })

  await ledgerAccountTypeTest.test('create should', async (test) => {
    try {
      const ledgerAccountType = {
        name: 'POSITION',
        description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
        isActive: 1,
        isSettleable: true
      }
      sandbox.stub(Db, 'getKnex')
      Db.getKnex.throws(new Error())
      await Model.create(ledgerAccountType.name, ledgerAccountType.description, ledgerAccountType.isActive, ledgerAccountType.isSettleable)
      test.fail('have thrown an error')
      test.end()
    } catch (err) {
      test.pass('throw an error')
      test.end()
    }
  })

  await ledgerAccountTypeTest.test('getAll', async (assert) => {
    const ledgerAccountTypes = [
      {
        name: 'POSITION',
        description: 'A single account for each currency with which the hub operates. The account is "held" by the Participant representing the hub in the switch',
        isActive: 1,
        isSettleable: true
      },
      {
        name: 'INTERCHANGE_FEE_SETTLEMENT',
        description: 'settlement account for interchange fees',
        isActive: 1,
        isSettleable: true
      }
    ]

    try {
      Db.ledgerAccountType.find.resolves(ledgerAccountTypes)
      const result = await Model.getAll()
      assert.equal(Db.ledgerAccountType.find.callCount, 1, 'should call the model create function')
      assert.deepEqual(Db.ledgerAccountType.find.lastCall.args[0], {}, 'should call the model with the right arguments: empty object')
      assert.deepEqual(result, ledgerAccountTypes)
      assert.end()
    } catch (err) {
      assert.fail('should not have thrown an error: ' + err)
      assert.end()
    }
  })

  await ledgerAccountTypeTest.test('getAll when the db fails', async (assert) => {
    try {
      Db.ledgerAccountType.find.throws(new Error())
      await Model.getAll()
      assert.fail('should have thrown an error')
      assert.end()
    } catch (err) {
      assert.ok(err instanceof Error, 'should throw an error')
      assert.end()
    }
  })

  await ledgerAccountTypeTest.end()
})
