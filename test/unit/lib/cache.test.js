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

    await initTest.test('pre-fetch all endpoints info at start', async (test) => {
      // Check that Enums haven't been called
      for (const enumId of Enums.enumsIds) {
        test.notOk(Enums[enumId].calledOnce)
      }

      // This should pre-fetch all enums
      await Cache.initCache()

      // Check that Enums have been called
      for (const enumId of Enums.enumsIds) {
        test.ok(Enums[enumId].calledOnce)
      }
      await Cache.destroyCache()
      test.end()
    })

    await initTest.test('call endpoints only once and then should return cached info (should not call endpoints again)', async (test) => {
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

    initTest.end()
  })

  cacheTest.end()
})
