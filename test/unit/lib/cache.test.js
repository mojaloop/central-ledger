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

  cacheTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Enums)
    allEnumsValue = {}
    for (const enumId of Enums.enumsIds) {
      Enums[enumId].returns(Promise.resolve(templateValueForEnum(enumId)))
      allEnumsValue[enumId] = templateValueForEnum(enumId)
    }
    Cache.registerCacheClient({
      id: 'testCacheClient',
      preloadCache: async () => sandbox.stub()
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

  await cacheTest.test('Cache client', async (participantTest) => {
    await participantTest.test('preload should be callled once during Cache.initCache()', async (test) => {
      let preloadCacheCalledCnt = 0
      Cache.registerCacheClient({
        id: 'testCacheClient',
        preloadCache: async () => {
          preloadCacheCalledCnt++
        }
      })

      // Test participant-getAll gets called during cache init
      test.ok(preloadCacheCalledCnt === 0, 'should not be called yet')
      await Cache.initCache()
      test.ok(preloadCacheCalledCnt === 1, 'should be called 1 time')

      // end
      await Cache.destroyCache()
      test.end()
    })
    /*
    await participantTest.test('when invalidateParticipantsCache() called it should call CatboxMemory::drop()', async (test) => {
      sandbox.stub(Cache.CatboxMemory.prototype, 'drop')
      await Cache.initCache()
      test.notOk(Cache.CatboxMemory.prototype.drop.calledOnce, 'participants cache drop was never called')
      await Cache.invalidateParticipantsCache()
      test.ok(Cache.CatboxMemory.prototype.drop.calledOnce, 'participants cache drop was called once')
      await Cache.destroyCache()
      test.end()
    })
    */
    participantTest.end()
  })

  cacheTest.end()
})
