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

 * Neal Donnan <neal.donnan@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const SettlementModelUncached = require('../../../../src/models/settlement/settlementModel')
const Cache = require('../../../../src/lib/cache')
const Model = require('../../../../src/models/settlement/settlementModelCached')

Test('SettlementModel cached model', async (settlementModelCachedTest) => {
  let sandbox

  const settlementModelFixtures = [
    {
      settlementModelId: 1,
      name: 'CGS',
      ledgerAccountTypeId: 1
    },
    {
      settlementModelId: 2,
      name: 'InterchangeFee',
      ledgerAccountTypeId: 6
    }
  ]

  settlementModelCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Cache)
    sandbox.stub(SettlementModelUncached)
    SettlementModelUncached.getAll.returns(settlementModelFixtures)
    t.end()
  })

  settlementModelCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await settlementModelCachedTest.test('initializes cache correctly', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({})
    }
    Cache.registerCacheClient.returns(cacheClient)

    // initialize calls registerCacheClient and createKey
    test.notOk(Cache.registerCacheClient.calledOnce)
    test.notOk(cacheClient.createKey.calledOnce)
    await Model.initialize()
    test.ok(Cache.registerCacheClient.calledOnce)
    test.ok(cacheClient.createKey.calledOnce)

    test.end()
  })

  await settlementModelCachedTest.test('calls drop() for invalidateSettlementModelsCache', async (test) => {
    // initialize
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      drop: sandbox.stub()
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // check
    test.notOk(cacheClient.drop.calledOnce)
    await Model.invalidateSettlementModelsCache()
    test.ok(cacheClient.drop.calledOnce)

    test.end()
  })

  await settlementModelCachedTest.test('getById(), getByName(), getByLedgerAccountTypeId() and getAll() work', async (test) => {
    let cache = null
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => cache,
      set: (key, x) => {
        cache = { item: x } // the cache retuns {item: <data>} structure
      }
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // check getById()
    const settlementModelById = await Model.getById(1)
    test.equal(JSON.stringify(settlementModelById), JSON.stringify(settlementModelFixtures[0]), 'getById() works')

    // check getByName()
    const settlementModelByName = await Model.getByName(settlementModelFixtures[1].name)
    test.equal(JSON.stringify(settlementModelByName), JSON.stringify(settlementModelFixtures[1]), 'getByName() works')

    // check getByLedgerAccountTypeId()
    const settlementModelByLedgerAccountTypeId = await Model.getByLedgerAccountTypeId(settlementModelFixtures[1].ledgerAccountTypeId)
    test.equal(JSON.stringify(settlementModelByLedgerAccountTypeId), JSON.stringify(settlementModelFixtures[1]), 'getByLedgerAccountTypeId() works')

    // check getAll()
    const participantsAll = await Model.getAll()
    test.equal(JSON.stringify(participantsAll), JSON.stringify(settlementModelFixtures), 'getAll() works')

    test.end()
  })

  await settlementModelCachedTest.test('getById(), getByName(), getByLedgerAccountTypeId() and getAll() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()
    SettlementModelUncached.getAll.throws(new Error())

    // check getById()
    try {
      await Model.getById(1)
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    // check getByName()
    try {
      await Model.getByName(settlementModelFixtures[1].name)
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    // check getByLedgerAccountTypeId()
    try {
      await Model.getByLedgerAccountTypeId(settlementModelFixtures[1].ledgerAccountTypeId)
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    // check getAll()
    try {
      await Model.getAll()
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    test.end()
  })

  await settlementModelCachedTest.end()
})
