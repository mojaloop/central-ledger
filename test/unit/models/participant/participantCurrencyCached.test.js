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

 * Roman Pietrzak <roman.pietrzak@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const ParticipantCurrencyUncached = require('../../../../src/models/participant/participantCurrency')
const Cache = require('../../../../src/lib/cache')
const Model = require('../../../../src/models/participant/participantCurrencyCached')

Test('ParticipantCurrency cached model', async (participantCurrencyCachedTest) => {
  let sandbox

  const participantCurrencyFixtures = [
    {
      participantCurrencyId: 1,
      participantId: 1,
      currencyId: 'USD',
      ledgerAccountTypeId: 2,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    },
    {
      participantCurrencyId: 2,
      participantId: 1,
      currencyId: 'USD',
      ledgerAccountTypeId: 3,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    },
    {
      participantCurrencyId: 3,
      participantId: 2,
      currencyId: 'USD',
      ledgerAccountTypeId: 2,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    }
  ]

  participantCurrencyCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Cache)
    sandbox.stub(ParticipantCurrencyUncached)
    ParticipantCurrencyUncached.getAll.returns(participantCurrencyFixtures)
    t.end()
  })

  participantCurrencyCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantCurrencyCachedTest.test('initializes cache correctly', async (test) => {
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

  await participantCurrencyCachedTest.test('calls drop() for invalidateParticipantsCache', async (test) => {
    // initialize
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      drop: sandbox.stub()
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // check
    test.notOk(cacheClient.drop.calledOnce)
    await Model.invalidateParticipantCurrencyCache()
    test.ok(cacheClient.drop.calledOnce)

    test.end()
  })

  await participantCurrencyCachedTest.test('getById(), getByParticipantId() and findOneByParams() work', async (test) => {
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
    const participantByParticipantId = await Model.getByParticipantId(participantCurrencyFixtures[1].participantId)
    const participantByParticipantIdMatch = [participantCurrencyFixtures[0], participantCurrencyFixtures[1]]
    test.equal(JSON.stringify(participantByParticipantId), JSON.stringify(participantByParticipantIdMatch), 'getByParticipantId(<arg>) works')

    // check getByParticipantId(<arg>, <arg>)
    const participantByParticipantIdWithLedgerType = await Model.getByParticipantId(
      participantCurrencyFixtures[1].participantId,
      participantCurrencyFixtures[1].ledgerAccountTypeId)
    test.equal(JSON.stringify(participantByParticipantIdWithLedgerType), JSON.stringify([participantCurrencyFixtures[1]]), 'getByParticipantId(<arg>, <arg>) works')

    // check findOneByParams()
    const oneParticipantByStricCriteria = await Model.findOneByParams(participantCurrencyFixtures[2])
    test.equal(JSON.stringify(oneParticipantByStricCriteria), JSON.stringify(participantCurrencyFixtures[2]), 'findOneByParams() works')

    test.end()
  })

  await participantCurrencyCachedTest.test('hubAccountExists works as expected', async (test) => {
    const resultFound = await Model.hubAccountExists('USD', 3)
    test.equal(resultFound, true)
    const resultNotFound = await Model.hubAccountExists('USD', 4)
    test.equal(resultNotFound, false)
    test.end()
  })

  await participantCurrencyCachedTest.test('create(), update(), destroyByParticipantId() call the participant model and invalidation', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantCurrencyCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 3 different functions
    const functionsToTest = ['create', 'update', 'destroyByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantCurrencyCache.notCalled, 'invalidateParticipantCurrencyCache() not yet called')
      test.ok(ParticipantCurrencyUncached[functionName].notCalled, `ParticipantCurrencyUncached.${functionName}() not yet called`)

      // call the function
      await Model[functionName]({})

      // check invalidateParticipantCurrencyCache and function under test was called once
      test.ok(Model.invalidateParticipantCurrencyCache.calledOnce, 'invalidateParticipantCurrencyCache() called once')
      test.ok(ParticipantCurrencyUncached[functionName].calledOnce, `ParticipantCurrencyUncached.${functionName}() called once`)

      // cleanup
      Model.invalidateParticipantCurrencyCache.resetHistory()
    }

    test.end()
  })

  await participantCurrencyCachedTest.test('create(), update(), destroyByParticipantId() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantCurrencyCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 4 different functions
    const functionsToTest = ['create', 'update', 'destroyByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      ParticipantCurrencyUncached[functionName].throws(new Error())

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantCurrencyCache.notCalled, 'invalidateParticipantsCache() not yet called')
      test.ok(ParticipantCurrencyUncached[functionName].notCalled, `ParticipantCurrencyUncached.${functionName}() not yet called`)

      // call the function
      try {
        await Model[functionName]({})
        test.fail(`Error not thrown for ${functionName}`)
      } catch (err) {
        test.pass(`Error thrown for ${functionName}`)
      }

      // check invalidateParticipantCurrencyCache and function under test was called once
      test.ok(Model.invalidateParticipantCurrencyCache.notCalled, 'invalidateParticipantCurrencyCache() not called, as the error was thrown')

      // cleanup
      Model.invalidateParticipantCurrencyCache.resetHistory()
    }

    test.end()
  })

  await participantCurrencyCachedTest.end()
})
