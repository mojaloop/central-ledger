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
      sandbox.stub(Cache.CatboxMemory)
      const catboxMemoryConstructorSpy = sandbox.spy(Cache, 'CatboxMemory')
      await Cache.initCache()
      test.ok(catboxMemoryConstructorSpy.calledOnce)
      await Cache.destroyCache()
      test.end()
    })

    await initTest.test('init+start and then stop CatboxMemory', async (test) => {
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

  await cacheTest.test('Cache client', async (cacheClientTest) => {
    await cacheClientTest.test('preload should be called once during Cache.initCache()', async (test) => {
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

    await cacheClientTest.test('get() should call Catbox Memory get()', async (test) => {
      const getSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'get')

      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        preloadCache: async () => {}
      })

      // Test get()
      test.notOk(getSpy.called, 'CatboxMemory::get() not called before initCache()')
      await Cache.initCache()
      getSpy.resetHistory()
      await cacheClient.get('')
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')

      // end
      await Cache.destroyCache()
      test.end()
    })

    await cacheClientTest.test('set() should call Catbox Memory set() and should work', async (test) => {
      const getSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'get')
      const setSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'set')
      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        preloadCache: async () => {}
      })
      const testKey = cacheClient.createKey('testKeyName')
      const valueToCache = { a: 'some random value', b: 10 }

      // Init cache
      test.notOk(setSpy.called, 'CatboxMemory::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Test set()
      await cacheClient.set(testKey, valueToCache)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by direct set()')

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')
      test.deepEqual(valueFromCache.item, valueToCache, 'value get()-ed from cache equals the one set()-ed before')

      // end
      await Cache.destroyCache()
      test.end()
    })

    await cacheClientTest.test('drop() works', async (test) => {
      const getSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'get')
      const setSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'set')
      const dropSpy = sandbox.spy(Cache.CatboxMemory.prototype, 'drop')
      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        preloadCache: async () => {}
      })
      const testKey = cacheClient.createKey('testKeyName')
      const valueToCache = { a: 'some random value', b: 10 }

      // Init cache
      test.notOk(dropSpy.called, 'CatboxMemory::drop() not called before initCache()')
      test.notOk(getSpy.called, 'CatboxMemory::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Test set()
      await cacheClient.set(testKey, valueToCache)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by direct set()')

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')
      test.deepEqual(valueFromCache.item, valueToCache, 'value get()-ed from cache equals the one set()-ed before')

      // Test drop()
      await cacheClient.drop(testKey)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by direct set()')

      // Verify the value doesn't exist in cache with get()
      const valueFromCacheAfterDrop = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')
      test.equal(valueFromCacheAfterDrop, null, 'value get()-ed from cache should be null')

      // end
      await Cache.destroyCache()
      test.end()
    })

    cacheClientTest.end()
  })

  cacheTest.end()
})
