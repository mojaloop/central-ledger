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

    t.end()
  })

  cacheTest.afterEach(t => {
    Cache.dropClients()
    Cache.destroyCache()
    sandbox.restore()
    t.end()
  })

  await cacheTest.test('Cache should', async (initTest) => {
    await initTest.test('call constructor of Catbox', async (test) => {
      const catboxConstructorSpy = sandbox.spy(Cache.Catbox, 'Policy')
      Cache.registerCacheClient('testClient', async () => { })
      await Cache.initCache()
      test.ok(catboxConstructorSpy.calledOnce, 'Catbox::Policy constructor called once')
      test.end()
    })

    await initTest.test('init+start and then stop Catbox', async (test) => {
      const fn = sandbox.spy(async () => { })
      Cache.registerCacheClient('testClient', fn)
      await Cache.initCache()
      test.ok(fn.calledOnce, 'generateFunc called once during initCache()')
      test.end()
    })
    initTest.end()
  })

  await cacheTest.test('Cache client', async (cacheClientTest) => {
    await cacheClientTest.test('preload should be called once during Cache.initCache()', async (test) => {
      let preloadCacheCalledCnt = 0
      Cache.registerCacheClient('testCacheClient', async () => {
        preloadCacheCalledCnt++
      })

      // Test participant-getAll gets called during cache init
      test.ok(preloadCacheCalledCnt === 0, 'should not be called yet')
      await Cache.initCache()
      test.ok(preloadCacheCalledCnt === 1, 'should be called 1 time')

      // end
      test.end()
    })

    await cacheClientTest.test('get() should call Catbox Memory get()', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'get')

      const cacheClient = Cache.registerCacheClient('testCacheClient', async () => {})

      // Test get()
      test.notOk(getSpy.called, 'Catbox::get() not called before initCache()')
      await Cache.initCache()
      getSpy.resetHistory()
      await cacheClient.get('')
      test.ok(getSpy.called, 'Catbox::get() was called once by direct get()')

      // end
      test.end()
    })

    await cacheClientTest.test('get() should NOT call Catbox Memory get() when cache is disabled', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = false
      const getSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'get')

      const cacheClient = Cache.registerCacheClient('testClient', async () => { })

      // Test get()
      test.notOk(getSpy.called, 'Catbox::get() not called before initCache()')
      await Cache.initCache()
      getSpy.resetHistory()
      await cacheClient.get('')
      test.notOk(getSpy.called, 'Catbox::get() was called once by direct get()')

      // end
      test.end()
    })

    await cacheClientTest.test('set() should call Catbox Memory set() and should work', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'get')
      const setSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'set')
      const value = { a: 'some random value', b: 10 }
      const cacheClient = Cache.registerCacheClient('testCacheClient', async () => value)
      const testKey = 'testKeyName'

      // Init cache
      test.notOk(setSpy.called, 'Catbox::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Test set()
      await cacheClient.get(testKey)
      test.ok(setSpy.called, 'Catbox::set() was called once by direct set()')

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'Catbox::get() was called once by direct get()')
      test.deepEqual(valueFromCache, value, 'value get()-ed from cache equals the one set()-ed before')

      // end
      test.end()
    })

    await cacheClientTest.test('drop() works', async (test) => {
      Config.CACHE_CONFIG.CACHE_ENABLED = true
      const getSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'get')
      const setSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'set')
      const dropSpy = sandbox.spy(Cache.Catbox.Policy.prototype, 'drop')
      const valueToCache = { a: 'some random value', b: 10 }
      const fn = sandbox.spy(async () => valueToCache)
      const cacheClient = Cache.registerCacheClient('testCacheClient', fn)
      const testKey = 'testKeyName'

      // Init cache
      test.notOk(dropSpy.called, 'Catbox::drop() not called before initCache()')
      test.notOk(getSpy.called, 'Catbox::set() not called before initCache()')
      await Cache.initCache()
      setSpy.resetHistory()
      getSpy.resetHistory()

      // Verify the value with get()
      const valueFromCache = await cacheClient.get(testKey)
      test.ok(getSpy.called, 'Catbox::get() was called once by direct get()')
      test.deepEqual(valueFromCache, valueToCache, 'value from cache equals the generated one')
      test.ok(fn.calledTwice, 'generation function was called twice')
      fn.resetHistory()
      await cacheClient.get(testKey)
      test.notOk(fn.called, 'generation function was NOT called again on cache hit')

      // Test drop()
      await cacheClient.drop(testKey)
      test.ok(setSpy.called, 'Catbox::set() was called once by direct set()')

      // Verify the generation function is called after drop
      const valueFromCacheAfterDrop = await cacheClient.get(testKey)
      test.ok(fn.called, 'generation function was called again after drop()')
      test.ok(getSpy.called, 'Catbox::get() was called once by direct get()')
      test.equal(valueFromCacheAfterDrop, valueToCache, 'value from cache equals the generated one')

      // end
      test.end()
    })

    cacheClientTest.end()
  })

  cacheTest.end()
})
