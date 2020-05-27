/*****
 Test that integrated enumsCached.js and cache.js work together as expected.

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
const EnumUncached = require('../../../src/lib/enum')
const Config = require('../../../src/lib/config')
const Cache = require('../../../src/lib/cache')
const Model = require('../../../src/lib/enumCached')

Test('Enums with caching', async (enumCachedTest) => {
  let sandbox
  let allEnumsValue

  const templateValueForEnum = (enumId) => {
    return { testEnumKey: `testEnum of ${enumId}` }
  }

  enumCachedTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(EnumUncached)
    sandbox.stub(Config.CACHE_CONFIG, 'CACHE_ENABLED')
    Config.CACHE_CONFIG.CACHE_ENABLED = true
    allEnumsValue = {}
    for (const enumId of EnumUncached.enumsIds) {
      EnumUncached[enumId].returns(Promise.resolve(templateValueForEnum(enumId)))
      allEnumsValue[enumId] = templateValueForEnum(enumId)
    }
    t.end()
  })

  enumCachedTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  await enumCachedTest.test('Cache should pre-fetch all enums info at start', async (test) => {
    // Check that Enums haven't been called
    for (const enumId of EnumUncached.enumsIds) {
      test.notOk(EnumUncached[enumId].calledOnce, `enum ${enumId} wasn't called before initCache`)
    }

    // This should pre-fetch all enums
    await Model.initialize()
    await Cache.initCache()

    // Check that Enums have been called
    for (const enumId of EnumUncached.enumsIds) {
      test.ok(EnumUncached[enumId].calledOnce, `enum ${enumId} was called once during initCache`)
    }
    await Cache.destroyCache()
    await Cache.dropClients()
    test.end()
  })

  await enumCachedTest.test('should call enums only once and then should return cached data (should not call enums again)', async (test) => {
    // Check that Enums haven't been called
    for (const enumId of EnumUncached.enumsIds) {
      test.notOk(EnumUncached[enumId].calledOnce, `enum ${enumId} wasn't called before initCache`)
    }

    // This should pre-fetch all enums
    await Model.initialize()
    await Cache.initCache()

    // Check that Enums have been called once
    for (const enumId of EnumUncached.enumsIds) {
      test.ok(EnumUncached[enumId].calledOnce, `enum ${enumId} was called once`)
    }

    // Get Enum info from cache and verify values
    for (const enumId of EnumUncached.enumsIds) {
      const returnedValue = await Model.getEnums(enumId)
      test.deepEqual(templateValueForEnum(enumId), returnedValue, `value for enum ${enumId} is correct`)
    }

    // Check again that Enums have been called once (so cache worked)
    for (const enumId of EnumUncached.enumsIds) {
      test.ok(EnumUncached[enumId].calledOnce, `enum ${enumId} was still called just once`)
    }

    // Let's check the "all" summary-enum also works well on cached values
    const returnedAllEnumsValue = await Model.getEnums('all')
    test.deepEqual(returnedAllEnumsValue, allEnumsValue, 'the "all" enum type works well')

    // Check again that Enums have been called once (so cache worked)
    for (const enumId of EnumUncached.enumsIds) {
      test.ok(EnumUncached[enumId].calledOnce, `enum ${enumId} was still called just once`)
    }
    await Cache.destroyCache()
    await Cache.dropClients()
    test.end()
  })

  await enumCachedTest.end()
})
