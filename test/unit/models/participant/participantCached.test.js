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
const ParticipantUncached = require('../../../../src/models/participant/participant')
const Cache = require('../../../../src/lib/cache')
const Model = require('../../../../src/models/participant/participantCached')

Test('Participant cached model', async (participantCachedTest) => {
  let sandbox

  const participantFixtures = [
    {
      participantId: '1',
      name: 'fsp1z',
      currency: 'USD',
      isActive: 1,
      createdDate: new Date()
    },
    {
      participantId: '2',
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: new Date()
    }
  ]

  participantCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Cache)
    sandbox.stub(ParticipantUncached)
    ParticipantUncached.getAll.returns(participantFixtures)
    t.end()
  })

  participantCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await participantCachedTest.test('initializes cache correctly', async (test) => {
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

  await participantCachedTest.test('calls drop() for invalidateParticipantsCache', async (test) => {
    // initialize
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      drop: sandbox.stub()
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // check
    test.notOk(cacheClient.drop.calledOnce)
    await Model.invalidateParticipantsCache()
    test.ok(cacheClient.drop.calledOnce)

    test.end()
  })

  await participantCachedTest.test('getById(), getByName() and getAll() work', async (test) => {
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
    const participantById = await Model.getById(1)
    test.equal(JSON.stringify(participantById), JSON.stringify(participantFixtures[0]), 'getById() works')

    // check getByName()
    const participantByName = await Model.getByName(participantFixtures[1].name)
    test.equal(JSON.stringify(participantByName), JSON.stringify(participantFixtures[1]), 'getByName() works')

    // check getAll()
    const participantsAll = await Model.getAll()
    test.equal(JSON.stringify(participantsAll), JSON.stringify(participantFixtures), 'getAll() works')

    test.end()
  })

  await participantCachedTest.test('getById(), getByName() and getAll() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()
    ParticipantUncached.getAll.throws(new Error())

    // check getById()
    try {
      await Model.getById(1)
      test.fail('Error not thrown')
    } catch (err) {
      test.pass('Error thrown')
    }

    // check getByName()
    try {
      await Model.getByName(participantFixtures[1].name)
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

  await participantCachedTest.test('create(), update(), destroyByName() and destroyParticipantEndpointByParticipantId() call the participant model and invalidation', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantsCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 4 different functions
    const functionsToTest = ['create', 'update', 'destroyByName', 'destroyParticipantEndpointByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantsCache.notCalled, 'invalidateParticipantsCache() not yet called')
      test.ok(ParticipantUncached[functionName].notCalled, `ParticipantUncached.${functionName}() not yet called`)

      // call the function
      await Model[functionName]({})

      // check invalidateParticipantsCache and function under test was called once
      test.ok(Model.invalidateParticipantsCache.calledOnce, 'invalidateParticipantsCache() called once')
      test.ok(ParticipantUncached[functionName].calledOnce, `ParticipantUncached.${functionName}() called once`)

      // cleanup
      Model.invalidateParticipantsCache.resetHistory()
    }

    test.end()
  })

  await participantCachedTest.test('create(), update(), destroyByName() and destroyParticipantEndpointByParticipantId() fail when error thrown', async (test) => {
    const cacheClient = {
      createKey: sandbox.stub().returns({}),
      get: () => null
    }
    sandbox.stub(Model, 'invalidateParticipantsCache')

    Cache.registerCacheClient.returns(cacheClient)
    await Model.initialize()

    // test same things for 4 different functions
    const functionsToTest = ['create', 'update', 'destroyByName', 'destroyParticipantEndpointByParticipantId']
    for (const functionToTestIdx in functionsToTest) {
      const functionName = functionsToTest[functionToTestIdx]

      ParticipantUncached[functionName].throws(new Error())

      // make sure nothing was called before
      test.ok(Model.invalidateParticipantsCache.notCalled, 'invalidateParticipantsCache() not yet called')
      test.ok(ParticipantUncached[functionName].notCalled, `ParticipantUncached.${functionName}() not yet called`)

      // call the function
      try {
        await Model[functionName]({})
        test.fail(`Error not thrown for ${functionName}`)
      } catch (err) {
        test.pass(`Error thrown for ${functionName}`)
      }

      // check invalidateParticipantsCache and function under test was called once
      test.ok(Model.invalidateParticipantsCache.notCalled, 'invalidateParticipantsCache() not called, as the error was thrown')

      // cleanup
      Model.invalidateParticipantsCache.resetHistory()
    }

    test.end()
  })

  await participantCachedTest.end()
})
