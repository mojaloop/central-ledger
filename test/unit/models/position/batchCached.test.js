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

 * Kevin Leyow <kevin.leyow@infitx.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const BatchUncached = require('../../../../src/models/position/batch')
const Cache = require('../../../../src/lib/cache')
const Model = require('../../../../src/models/position/batchCached')

Test('Batch cached model', async (batchCachedTest) => {
  let sandbox

  const participantCurrencyFixtures = [
    {
      participantCurrencyId: 7,
      participantId: 2,
      currencyId: 'USD',
      ledgerAccountTypeId: 1,
      isActive: 1,
      createdDate: '2023-08-17T09:36:27.000Z',
      createdBy: 'unknown'
    },
    {
      participantCurrencyId: 15,
      participantId: 3,
      currencyId: 'USD',
      ledgerAccountTypeId: 1,
      isActive: 1,
      createdDate: '2023-08-17T09:36:37.000Z',
      createdBy: 'unknown'
    },
    {
      participantCurrencyId: 16,
      participantId: 3,
      currencyId: 'USD',
      ledgerAccountTypeId: 1,
      isActive: 1,
      createdDate: '2023-08-17T09:36:37.000Z',
      createdBy: 'unknown'
    }
  ]

  batchCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Cache)
    sandbox.stub(BatchUncached)
    BatchUncached.getAllParticipantCurrency.returns(participantCurrencyFixtures)
    t.end()
  })

  batchCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await batchCachedTest.test('initializes cache correctly', async (test) => {
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

  await batchCachedTest.test('getParticipantCurrencyByIds(), getParticipantCurrencyByParticipantIds() work', async (test) => {
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

    // check getParticipantCurrencyByIds()
    const participantCurrencyById = await Model.getParticipantCurrencyByIds(null, [7, 15])
    test.equal(JSON.stringify(participantCurrencyById), JSON.stringify([participantCurrencyFixtures[0], participantCurrencyFixtures[1]]), 'getParticipantCurrencyByIds() works')

    // check getParticipantCurrencyByParticipantIds()
    const participantByName = await Model.getParticipantCurrencyByParticipantIds(null, [participantCurrencyFixtures[1].participantId])
    test.equal(JSON.stringify(participantByName), JSON.stringify([participantCurrencyFixtures[1], participantCurrencyFixtures[2]]), 'getParticipantCurrencyByParticipantIds() works')

    test.end()
  })

  await batchCachedTest.test('getParticipantCurrencyByIds(), getParticipantCurrencyByParticipantIds() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()
    BatchUncached.getAllParticipantCurrency.throws(new Error())

    try {
      await Model.getParticipantCurrencyByIds(null, [7])
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    try {
      await Model.getParticipantCurrencyByParticipantIds(null, [participantCurrencyFixtures[1].participantId])
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    test.end()
  })

  await batchCachedTest.end()
})
