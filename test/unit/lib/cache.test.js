'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Config = require('../../../src/lib/config')
const Cache = require('../../../src/lib/cache')
const Enums = require('../../../src/lib/enum')

Test('Cache test', async (cacheTest) => {
  let sandbox

  cacheTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Enums)
    Cache.registerCacheClient({
      id: 'testCacheClient',
      generate: async () => {},
      preloadCache: async () => sandbox.stub()
    })

    t.end()
  })

  cacheTest.afterEach(t => {
    Cache.dropClients()
    Cache.destroyCache()
    sandbox.restore()
    t.end()
  })

  await cacheTest.test('Cache should', async (initTest) => {
    sandbox.stub(Cache.CatboxMemory.Engine)

    await initTest.test('not call constructor of CatboxMemory when cache is not enabled', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = false
      const catboxMemoryConstructorSpy = sandbox.spy(Cache.CatboxMemory, 'Engine')
      await Cache.initCache()
      test.notOk(catboxMemoryConstructorSpy.called)
      await Cache.destroyCache()
      test.end()
    })

    await initTest.test('call constructor of CatboxMemory when cache is enabled', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const catboxMemoryConstructorSpy = sandbox.spy(Cache.CatboxMemory, 'Engine')
      await Cache.initCache()
      test.ok(catboxMemoryConstructorSpy.calledOnce)
      await Cache.destroyCache()
      test.end()
    })

    await initTest.test('init+start and then stop CatboxMemory', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'start')
      sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'stop')
      await Cache.initCache()
      test.ok(Cache.CatboxMemory.Engine.prototype.start.calledOnce)
      test.notOk(Cache.CatboxMemory.Engine.prototype.stop.calledOnce)
      await Cache.destroyCache()
      test.ok(Cache.CatboxMemory.Engine.prototype.start.calledOnce)
      test.ok(Cache.CatboxMemory.Engine.prototype.stop.calledOnce)
      test.end()
    })
    initTest.end()
  })

  await cacheTest.test('Cache client', async (cacheClientTest) => {
    await cacheClientTest.test('preload should be called once during Cache.initCache()', async (test) => {
      let preloadCacheCalledCnt = 0
      Cache.registerCacheClient({
        id: 'testCacheClient',
        generate: async () => {},
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
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'get')

      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        generate: async () => {}
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

    await cacheClientTest.test('get() should NOT call Catbox Memory get() when cache is disabled', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = false
      const getSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'get')

      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        generate: async () => {}
      })

      // Test get()
      test.notOk(getSpy.called, 'CatboxMemory::get() not called before initCache()')
      await Cache.initCache()
      getSpy.resetHistory()
      await cacheClient.get('')
      test.notOk(getSpy.called, 'CatboxMemory::get() was called once by direct get()')

      // end
      await Cache.destroyCache()
      test.end()
    })

    await cacheClientTest.test('set() should call Catbox Memory set() and should work', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'get')
      const setSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'set')
      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        generate: async () => valueToCache
      })
      const testKey = 'testKeyName'
      const valueToCache = { a: 'some random value', b: 10 }

      // Init cache
      test.notOk(setSpy.called, 'CatboxMemory::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Test set()
      await cacheClient.get(testKey)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by get()')

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')
      test.deepEqual(valueFromCache, valueToCache, 'value get()-ed from cache equals the one set()-ed before')

      // Test cache hit
      getSpy.resetHistory()
      setSpy.resetHistory()
      const valueFromCacheHit = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get() for cache hit')
      test.deepEqual(valueFromCacheHit, valueToCache, 'value get()-ed from cache equals the one set()-ed before')
      test.notOk(setSpy.called, 'CatboxMemory::set() not called during cache hit get()')

      // end
      await Cache.destroyCache()
      test.end()
    })

    await cacheClientTest.test('drop() works', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'get')
      const setSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'set')
      const dropSpy = sandbox.spy(Cache.CatboxMemory.Engine.prototype, 'drop')
      const cacheClient = Cache.registerCacheClient({
        id: 'testCacheClient',
        generate: async () => valueToCache
      })
      const testKey = 'testKeyName'
      const valueToCache = { a: 'some random value', b: 10 }

      // Init cache
      test.notOk(dropSpy.called, 'CatboxMemory::drop() not called before initCache()')
      test.notOk(getSpy.called, 'CatboxMemory::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Test set()
      await cacheClient.get(testKey)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by direct set()')

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by direct get()')
      test.deepEqual(valueFromCache, valueToCache, 'value get()-ed from cache equals the one set()-ed before')

      // Test drop()
      await cacheClient.drop(testKey)
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by direct set()')

      // Verify the value doesn't exist in cache with get()
      test.ok(getSpy.called, 'CatboxMemory::get() was called once by after drop()')
      test.ok(setSpy.called, 'CatboxMemory::set() was called once by after drop()')

      // end
      await Cache.destroyCache()
      test.end()
    })

    cacheClientTest.end()
  })

  cacheTest.end()
})
