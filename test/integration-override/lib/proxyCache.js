/*****
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Infitx
 - Vijay Kumar Guthi <vijaya.guthi@infitx.com>
 - Kevin Leyow <kevin.leyow@infitx.com>
 - Kalin Krustev <kalin.krustev@infitx.com>
 - Steven Oderayi <steven.oderayi@infitx.com>
 - Eugen Klymniuk <eugen.klymniuk@infitx.com>

 --------------

 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('#src/lib/db')
const Cache = require('#src/lib/cache')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../src/lib/config')
const ProxyCache = require('#src/lib/proxyCache')
const ParticipantService = require('#src/domain/participant')
const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const ParticipantHelper = require('../../integration/helpers/participant')

const debug = false

Test('Participant service', async (participantTest) => {
  let sandbox
  const participantFixtures = []
  const participantMap = new Map()

  const testData = {
    currency: 'USD',
    fsp1Name: 'dfsp1',
    fsp2Name: 'dfsp2',
    endpointBase: 'http://localhost:1080',
    fsp3Name: 'payerfsp',
    fsp4Name: 'payeefsp',
    simulatorBase: 'http://localhost:8444',
    notificationEmail: 'test@example.com',
    proxyParticipant: 'xnProxy'
  }

  await participantTest.test('setup', async (test) => {
    try {
      sandbox = Sinon.createSandbox()
      await Db.connect(Config.DATABASE)
      await ParticipantCached.initialize()
      await ParticipantCurrencyCached.initialize()
      await ParticipantLimitCached.initialize()
      await Cache.initCache()
      await ProxyCache.connect()
      test.pass()
      test.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await participantTest.test('create participants', async (assert) => {
    try {
      let getByNameResult, result
      getByNameResult = await ParticipantService.getByName(testData.fsp1Name)
      result = await ParticipantHelper.prepareData(testData.fsp1Name, testData.currency, undefined, !!getByNameResult)
      participantFixtures.push(result.participant)
      getByNameResult = await ParticipantService.getByName(testData.fsp2Name)
      result = await ParticipantHelper.prepareData(testData.fsp2Name, testData.currency, undefined, !!getByNameResult)
      participantFixtures.push(result.participant)
      getByNameResult = await ParticipantService.getByName(testData.fsp3Name)
      result = await ParticipantHelper.prepareData(testData.fsp3Name, testData.currency, undefined, !!getByNameResult)
      participantFixtures.push(result.participant)
      getByNameResult = await ParticipantService.getByName(testData.fsp4Name)
      result = await ParticipantHelper.prepareData(testData.fsp4Name, testData.currency, undefined, !!getByNameResult)
      participantFixtures.push(result.participant)
      for (const participant of participantFixtures) {
        const read = await ParticipantService.getById(participant.participantId)
        participantMap.set(participant.participantId, read)
        if (debug) assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(read.name, participant.name, 'names are equal')
        assert.deepEqual(read.currencyList, participant.currencyList, 'currency match')
        assert.equal(read.isActive, participant.isActive, 'isActive flag matches')
        assert.equal(read.createdDate.toString(), participant.createdDate.toString(), 'created date matches')
      }
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getFSPProxy should return proxyId if fsp not in scheme', async (assert) => {
    try {
      const proxyCache = ProxyCache.getCache()
      proxyCache.addDfspIdToProxyMapping('notInSchemeFsp', 'proxyId')
      const result = await ProxyCache.getFSPProxy('notInSchemeFsp')
      assert.equal(result.inScheme, false, 'not in scheme')
      assert.equal(result.proxyId, 'proxyId', 'proxy id matches')
      proxyCache.removeDfspIdFromProxyMapping('notInSchemeFsp')
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getFSPProxy should not return proxyId if fsp is in scheme', async (assert) => {
    try {
      const proxyCache = ProxyCache.getCache()
      proxyCache.addDfspIdToProxyMapping('dfsp1', 'proxyId')
      const result = await ProxyCache.getFSPProxy('dfsp1')
      assert.equal(result.inScheme, true, 'is in scheme')
      assert.equal(result.proxyId, null, 'proxy id is null')
      proxyCache.removeDfspIdFromProxyMapping('dfsp1')
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('checkSameCreditorDebtorProxy should return true if debtor and creditor proxy are the same', async (assert) => {
    try {
      const proxyCache = ProxyCache.getCache()
      proxyCache.addDfspIdToProxyMapping('dfsp1', 'proxyId')
      proxyCache.addDfspIdToProxyMapping('dfsp2', 'proxyId')
      const result = await ProxyCache.checkSameCreditorDebtorProxy('dfsp1', 'dfsp2')
      assert.equal(result, true, 'returned true')
      proxyCache.removeDfspIdFromProxyMapping('dfsp1')
      proxyCache.removeDfspIdFromProxyMapping('dfsp2')
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('checkSameCreditorDebtorProxy should return false if debtor and creditor proxy are not the same', async (assert) => {
    try {
      const proxyCache = ProxyCache.getCache()
      proxyCache.addDfspIdToProxyMapping('dfsp1', 'proxyId')
      proxyCache.addDfspIdToProxyMapping('dfsp2', 'proxyId2')
      const result = await ProxyCache.checkSameCreditorDebtorProxy('dfsp1', 'dfsp2')
      assert.equal(result, false, 'returned false')
      proxyCache.removeDfspIdFromProxyMapping('dfsp1')
      proxyCache.removeDfspIdFromProxyMapping('dfsp2')
      assert.end()
    } catch (err) {
      Logger.error(`create participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('teardown', async (assert) => {
    try {
      for (const participant of participantFixtures) {
        if (participant.name === testData.fsp1Name ||
          participant.name === testData.fsp2Name ||
          participant.name === testData.fsp3Name ||
          participant.name === testData.fsp4Name) {
          assert.pass(`participant ${participant.name} preserved`)
        } else {
          const result = await ParticipantHelper.deletePreparedData(participant.name)
          assert.ok(result, `destroy ${participant.name} success`)
        }
      }
      await Cache.destroyCache()
      await Db.disconnect()
      await ProxyCache.disconnect()

      assert.pass('database connection closed')
      // @ggrg: Having the following 3 lines commented prevents the current test from exiting properly when run individually,
      // BUT it is required in order to have successful run of all integration test scripts as a sequence, where
      // the last script will actually disconnect topic-notification-event producer.
      // const Producer = require('../../../../src/handlers/lib/kafka/producer')
      // await Producer.getProducer('topic-notification-event').disconnect()
      // assert.pass('producer to topic-notification-event disconnected')
      sandbox.restore()
      assert.end()
    } catch (err) {
      Logger.error(`teardown failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.end()
})
