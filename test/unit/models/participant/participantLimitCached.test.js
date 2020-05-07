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
const ParticipantLimitUncached = require('../../../../src/models/participant/participantLimit')
const Cache = require('../../../../src/lib/cache')
const Model = require('../../../../src/models/participant/participantLimitCached')

Test('Participant Limit cached model', async (participantLimitCachedTest) => {
  let sandbox

  const participantLimitFixtures = [
    {
      participantLimitId: 1,
      participantCurrencyId: 3,
      participantLimitTypeId: 1,
      value: 1000000,
      thresholdAlarmPercentage: 10,
      startAfterParticipantPositionChangeId: null,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    },
    {
      participantLimitId: 2,
      participantCurrencyId: 5,
      participantLimitTypeId: 1,
      value: 1000000,
      thresholdAlarmPercentage: 10,
      startAfterParticipantPositionChangeId: null,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    },
    {
      participantLimitId: 3,
      participantCurrencyId: 7,
      participantLimitTypeId: 1,
      value: 1000000,
      thresholdAlarmPercentage: 10,
      startAfterParticipantPositionChangeId: null,
      isActive: 1,
      createdDate: new Date(),
      createdBy: 'theCreator'
    }
  ]

  participantLimitCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Cache)
    sandbox.stub(ParticipantLimitUncached)
    ParticipantLimitUncached.getAll.returns(participantLimitFixtures)
    t.end()
  })

  participantLimitCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantLimitCachedTest.test('initializes cache correctly', async (test) => {
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

  await participantLimitCachedTest.test('calls drop() for invalidateParticipantLimitCache', async (test) => {
    // initialize
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      drop: sandbox.stub()
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // check
    test.notOk(cacheClient.drop.calledOnce)
    await Model.invalidateParticipantLimitCache()
    test.ok(cacheClient.drop.calledOnce)

    test.end()
  })

  await participantLimitCachedTest.test('getByParticipantCurrencyId() works and manages cache correctly', async (test) => {
    let cache = null
    let cacheGetCallsCnt = 0
    let cacheSetCallsCnt = 0
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => {
        cacheGetCallsCnt++
        return cache
      },
      set: (key, x) => {
        cache = { item: x } // the cache retuns {item: <data>} structure
        cacheSetCallsCnt++
      }
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // make sure get/set wasn't called during inits
    test.equal(cacheGetCallsCnt, 0, 'no cache.get() called')
    test.equal(cacheSetCallsCnt, 0, 'no cache.set() called')

    // check getById()
    let participantByParticipantId = await Model.getByParticipantCurrencyId(participantLimitFixtures[1].participantCurrencyId)
    test.equal(JSON.stringify(participantByParticipantId), JSON.stringify(participantLimitFixtures[1]), 'getByParticipantId(<arg>) works')

    // check that get/set was called once when getByParticipantCurrencyId() for the 1st time
    test.equal(cacheGetCallsCnt, 1, 'cache.get() called once')
    test.equal(cacheSetCallsCnt, 1, 'cache.set() called once')

    // check getById()
    participantByParticipantId = await Model.getByParticipantCurrencyId(participantLimitFixtures[1].participantCurrencyId)
    test.equal(JSON.stringify(participantByParticipantId), JSON.stringify(participantLimitFixtures[1]), 'getByParticipantId(<arg>) works')

    // check that get called again, but set wasn't
    test.equal(cacheGetCallsCnt, 2, 'cache.get() called twice')
    test.equal(cacheSetCallsCnt, 1, 'cache.set() called once')

    test.end()
  })

  await participantLimitCachedTest.test('insert(), update(), destroyByParticipantCurrencyId() and destroyByParticipantId() call the participant-limit model and cache invalidation', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantLimitCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 4 different functions
    const functionsToTest = ['insert', 'update', 'destroyByParticipantCurrencyId', 'destroyByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantLimitCache.notCalled, 'invalidateParticipantLimitCache() not yet called')
      test.ok(ParticipantLimitUncached[functionName].notCalled, `ParticipantLimitUncached.${functionName}() not yet called`)

      // call the function
      await Model[functionName]({})

      // check invalidateParticipantLimitCache and function under test was called once
      test.ok(Model.invalidateParticipantLimitCache.calledOnce, 'invalidateParticipantLimitCache() called once')
      test.ok(ParticipantLimitUncached[functionName].calledOnce, `ParticipantLimitUncached.${functionName}() called once`)

      // cleanup
      Model.invalidateParticipantLimitCache.resetHistory()
    }

    test.end()
  })

  await participantLimitCachedTest.test('insert(), update(), destroyByParticipantCurrencyId() and destroyByParticipantId() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantLimitCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 4 different functions
    const functionsToTest = ['insert', 'update', 'destroyByParticipantCurrencyId', 'destroyByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      ParticipantLimitUncached[functionName].throws(new Error())

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantLimitCache.notCalled, 'invalidateParticipantLimitCache() not yet called')
      test.ok(ParticipantLimitUncached[functionName].notCalled, `ParticipantLimitUncached.${functionName}() not yet called`)

      // call the function
      try {
        await Model[functionName]({})
        test.fail(`Error not thrown for ${functionName}`)
      } catch (err) {
        test.pass(`Error thrown for ${functionName}`)
      }

      // check invalidateParticipantLimitCache and function under test was called once
      test.ok(Model.invalidateParticipantLimitCache.notCalled, 'invalidateParticipantLimitCache() not called, as the error was thrown')

      // cleanup
      Model.invalidateParticipantLimitCache.resetHistory()
    }

    test.end()
  })

  await participantLimitCachedTest.end()
})
