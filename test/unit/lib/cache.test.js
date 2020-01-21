'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Cache = require('../../../src/lib/cache')
const Enums = require('../../../src/lib/enum')

Test('Cache test', async (cacheTest) => {
  let sandbox
  let allEnumsValue

  const templateValueForEnum = (enumId) => {
    return { testEnumKey: `testEnum of ${enumId}` }
  }

  const participantFixtures = [
    {
      participantId: '1',
      name: 'fsp1z',
      currency: 'USD',
      isActive: 1,
      createdDate: (new Date()).toString()
    },
    {
      participantId: '2',
      name: 'fsp2',
      currency: 'EUR',
      isActive: 1,
      createdDate: (new Date()).toString()
    }
  ]

  cacheTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Enums)
    allEnumsValue = {}
    for (const enumId of Enums.enumsIds) {
      Enums[enumId].returns(Promise.resolve(templateValueForEnum(enumId)))
      allEnumsValue[enumId] = templateValueForEnum(enumId)
    }
    Cache.registerParticipantClient({
      getAllNoCache: async () => { return participantFixtures }
    })

    t.end()
  })

  cacheTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await cacheTest.test('Cache should', async (initTest) => {
    await initTest.test('call constructor of CatboxMemory', async (test) => {
      const catboxMemoryConstructorSpy = sandbox.spy(Cache, 'CatboxMemory')
      await Cache.initCache()
      test.ok(catboxMemoryConstructorSpy.calledOnce)
      await Cache.destroyCache()
      test.end()
    })

    await initTest.test('init+start and then stop CatboxMemory', async (test) => {
      sandbox.stub(Cache.CatboxMemory)
      sandbox.spy(Cache.CatboxMemory.prototype, 'start')
      sandbox.spy(Cache.CatboxMemory.prototype, 'stop')
      await Cache.initCache()
      test.ok(Cache.CatboxMemory.prototype.start.calledOnce)
      test.notOk(Cache.CatboxMemory.prototype.stop.calledOnce)
      await Cache.destroyCache()
      test.ok(Cache.CatboxMemory.prototype.start.calledOnce)
      test.ok(Cache.CatboxMemory.prototype.stop.calledOnce)
      test.end()
    })
    initTest.end()
  })

  await cacheTest.test('Caching enums:', async (enumTest) => {
    await enumTest.test('should pre-fetch all enums info at start', async (test) => {
      // Check that Enums haven't been called
      for (const enumId of Enums.enumsIds) {
        test.notOk(Enums[enumId].calledOnce, `enum ${enumId} wasn't called before initCache`)
      }

      // This should pre-fetch all enums
      await Cache.initCache()

      // Check that Enums have been called
      for (const enumId of Enums.enumsIds) {
        test.ok(Enums[enumId].calledOnce, `enum ${enumId} was called once during initCache`)
      }
      await Cache.destroyCache()
      test.end()
    })

    await enumTest.test('should call enums only once and then should return cached data (should not call enums again)', async (test) => {
      // This should pre-fetch all enums
      await Cache.initCache()

      // Check that Enums have been called once
      for (const enumId of Enums.enumsIds) {
        test.ok(Enums[enumId].calledOnce, `enum ${enumId} was called once`)
      }

      // Get Enum info from cache and verify values
      for (const enumId of Enums.enumsIds) {
        const returnedValue = await Cache.getEnums(enumId)
        test.deepEqual(templateValueForEnum(enumId), returnedValue, `value for enum ${enumId} is correct`)
      }

      // Check again that Enums have been called once (so cache worked)
      for (const enumId of Enums.enumsIds) {
        test.ok(Enums[enumId].calledOnce, `enum ${enumId} was still called just once`)
      }

      // Let's check the "all" summary-enum also works well on cached values
      const returnedAllEnumsValue = await Cache.getEnums('all')
      test.deepEqual(returnedAllEnumsValue, allEnumsValue, 'the "all" enum type works well')

      // Check again that Enums have been called once (so cache worked)
      for (const enumId of Enums.enumsIds) {
        test.ok(Enums[enumId].calledOnce, `enum ${enumId} was still called just once`)
      }

      await Cache.destroyCache()
      test.end()
    })

    enumTest.end()
  })

  await cacheTest.test('Caching participants:', async (participantTest) => {
    await participantTest.test('should pre-fetch participants info at start and do not fetch again', async (test) => {
      // Prepare API callback which counts self-calls
      let getAllNoCacheCalledCnt = 0
      Cache.registerParticipantClient({
        getAllNoCache: async () => {
          getAllNoCacheCalledCnt++
          return participantFixtures
        }
      })

      // Test participant-getAll gets called during cache init
      await Cache.initCache()
      test.ok(getAllNoCacheCalledCnt === 1)

      // Test participant-getAll doesn't get called again - the cache works
      const allParticipants = await Cache.getParticipantsCached()
      test.ok(getAllNoCacheCalledCnt === 1)

      // ...and returns expected data structure
      test.deepEqual(allParticipants.allParticipants, participantFixtures, 'Participant list is correct')
      test.deepEqual(allParticipants.indexById[1], participantFixtures[0], 'Participant index-by-id is correct')
      test.deepEqual(allParticipants.indexById[2], participantFixtures[1], 'Participant index-by-id is correct')
      test.deepEqual(allParticipants.indexByName.fsp1z, participantFixtures[0], 'Participant index-by-name is correct')
      test.deepEqual(allParticipants.indexByName.fsp2, participantFixtures[1], 'Participant index-by-name is correct')

      // end
      await Cache.destroyCache()
      test.end()
    })
    participantTest.end()
  })

  cacheTest.end()
})
