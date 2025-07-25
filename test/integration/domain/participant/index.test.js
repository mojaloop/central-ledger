/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 * Valentin Genev <valentin.genev@modusbox.com>
 * Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 * Miguel de Barros <miguel.debarros@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const Test = require('tape')
const Sinon = require('sinon')
const Db = require('../../../../src/lib/db')
const Cache = require('../../../../src/lib/cache')
const ProxyCache = require('../../../../src/lib/proxyCache')
const Logger = require('@mojaloop/central-services-logger')
const Config = require('../../../../src/lib/config')
const ParticipantService = require('../../../../src/domain/participant')
const ParticipantCached = require('../../../../src/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../../src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../../src/models/participant/participantLimitCached')
const ParticipantHelper = require('../../helpers/participant')
const ParticipantEndpointHelper = require('../../helpers/participantEndpoint')
const ParticipantLimitHelper = require('../../helpers/participantLimit')
const Enum = require('@mojaloop/central-services-shared').Enum
const MLNumber = require('@mojaloop/ml-number')

const debug = false

Test('Participant service', async (participantTest) => {
  let sandbox
  const participantFixtures = []
  const endpointsFixtures = []
  const participantProxyFixtures = []
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
      await ProxyCache.connect()
      await ParticipantCached.initialize()
      await ParticipantCurrencyCached.initialize()
      await ParticipantLimitCached.initialize()
      await Cache.initCache()
      test.pass()
      test.end()
    } catch (err) {
      Logger.error(`Setup for test failed with error - ${err}`)
      test.fail()
      test.end()
    }
  })

  await participantTest.test('check if Hub accounts exist and create them if not', async (assert) => {
    try {
      const hubReconciliationAccountExists = await ParticipantService.hubAccountExists(testData.currency, Enum.Accounts.LedgerAccountType.HUB_RECONCILIATION)
      if (!hubReconciliationAccountExists) {
        const newCurrencyAccount = await ParticipantService.createHubAccount(Config.HUB_ID, testData.currency, Enum.Accounts.LedgerAccountType.HUB_RECONCILIATION)
        assert.ok(newCurrencyAccount, `${testData.currency} HUB_RECONCILIATION created`)
        assert.equal(newCurrencyAccount.participantCurrency.currencyId, testData.currency, 'HUB_RECONCILIATION currency matched')
      } else {
        assert.pass(`${testData.currency} HUB_RECONCILIATION found`)
      }
      const hubMlnsAccountExists = await ParticipantService.hubAccountExists(testData.currency, Enum.Accounts.LedgerAccountType.HUB_MULTILATERAL_SETTLEMENT)
      if (!hubMlnsAccountExists) {
        const newCurrencyAccount = await ParticipantService.createHubAccount(Config.HUB_ID, testData.currency, Enum.Accounts.LedgerAccountType.HUB_MULTILATERAL_SETTLEMENT)
        assert.ok(newCurrencyAccount, `${testData.currency} HUB_MULTILATERAL_SETTLEMENT created`)
        assert.equal(newCurrencyAccount.participantCurrency.currencyId, testData.currency, 'HUB_MULTILATERAL_SETTLEMENT currency matched')
      } else {
        assert.pass(`${testData.currency} HUB_MULTILATERAL_SETTLEMENT found`)
      }

      assert.end()
    } catch (err) {
      Logger.error(`prepareTransferDataTest failed with error - ${err}`)
      assert.fail()
      assert.end()
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

  await participantTest.test('getByName', async (assert) => {
    try {
      for (const participant of participantFixtures) {
        const result = await ParticipantService.getByName(participant.name)
        assert.equal(result.name, participant.name, 'names are equal')
        assert.deepEqual(result.currencyList, participant.currencyList, 'currencies match')
        assert.equal(result.isActive, participant.isActive, 'isActive flag matches')
        assert.equal(result.createdDate.toString(), participant.createdDate.toString(), 'created date matches')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get participant by name failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAll', async (assert) => {
    try {
      const result = await ParticipantService.getAll()
      assert.ok(result, 'returns result')
      assert.end()
    } catch (err) {
      Logger.error(`get all participants failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getById', async (assert) => {
    try {
      for (const participantId of participantMap.keys()) {
        const participant = await ParticipantService.getById(participantId)
        assert.equal(JSON.stringify(participant), JSON.stringify(participantMap.get(participantId)))
        assert.equal(participant.isProxy, 0, 'isProxy flag set to false')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get participant by Id failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('add participant endpoint', async (assert) => {
    try {
      let participant = participantFixtures[0]
      let result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${testData.endpointBase}/transfers`)
      endpointsFixtures.push(result)
      result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${testData.endpointBase}/transfers/{{transferId}}`)
      endpointsFixtures.push(result)
      result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${testData.endpointBase}/transfers/{{transferId}}/error`)
      endpointsFixtures.push(result)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${testData.endpointBase}/bulkTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${testData.endpointBase}/bulkTransfers/{{id}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${testData.endpointBase}/bulkTransfers/{{id}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_QUOTES', `${testData.endpointBase}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL', testData.notificationEmail)
      result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_AUTHORIZATIONS', testData.endpointBase)
      endpointsFixtures.push(result)
      result = await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE', testData.endpointBase)
      endpointsFixtures.push(result)
      for (const endpoint of endpointsFixtures) {
        const read = await ParticipantService.getEndpoint(participant.name, endpoint.type)
        assert.equal(read[0].name, endpoint.type, `endpoint type ${endpoint.type} equal`)
        assert.equal(read[0].value, endpoint.value, 'endpoint values match')
      }
      participant = participantFixtures[1]
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${testData.endpointBase}/transfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${testData.endpointBase}/transfers/{{transferId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${testData.endpointBase}/transfers/{{transferId}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${testData.endpointBase}/bulkTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${testData.endpointBase}/bulkTransfers/{{id}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${testData.endpointBase}/bulkTransfers/{{id}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_QUOTES', `${testData.endpointBase}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_AUTHORIZATIONS', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES, `${testData.endpointBase}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST, `${testData.endpointBase}/fxTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}/error`)
      participant = participantFixtures[2]
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${testData.simulatorBase}/${participant.name}/transfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${testData.simulatorBase}/${participant.name}/transfers/{{transferId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${testData.simulatorBase}/${participant.name}/transfers/{{transferId}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${testData.simulatorBase}/bulkTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${testData.simulatorBase}/bulkTransfers/{{id}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${testData.simulatorBase}/bulkTransfers/{{id}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_QUOTES', `${testData.simulatorBase}/${participant.name}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_AUTHORIZATIONS', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES, `${testData.endpointBase}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST, `${testData.endpointBase}/fxTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}/error`)
      participant = participantFixtures[3]
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_POST', `${testData.simulatorBase}/${participant.name}/transfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_PUT', `${testData.simulatorBase}/${participant.name}/transfers/{{transferId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRANSFER_ERROR', `${testData.simulatorBase}/${participant.name}/transfers/{{transferId}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_POST', `${testData.simulatorBase}/bulkTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_PUT', `${testData.simulatorBase}/bulkTransfers/{{id}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_BULK_TRANSFER_ERROR', `${testData.simulatorBase}/bulkTransfers/{{id}}/error`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_QUOTES', `${testData.simulatorBase}/${participant.name}`)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_THRESHOLD_BREACH_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'NET_DEBIT_CAP_ADJUSTMENT_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'SETTLEMENT_TRANSFER_POSITION_CHANGE_EMAIL', testData.notificationEmail)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_AUTHORIZATIONS', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, 'FSPIOP_CALLBACK_URL_TRX_REQ_SERVICE', testData.endpointBase)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_QUOTES, `${testData.endpointBase}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_POST, `${testData.endpointBase}/fxTransfers`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_PUT, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}`)
      await ParticipantEndpointHelper.prepareData(participant.name, Enum.EndPoints.FspEndpointTypes.FSPIOP_CALLBACK_URL_FX_TRANSFER_ERROR, `${testData.endpointBase}/fxTransfers/{{commitRequestId}}/error`)
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`add participant endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getEndpoint', async (assert) => {
    try {
      for (const endpoint of endpointsFixtures) {
        const result = await ParticipantService.getEndpoint(participantFixtures[0].name, endpoint.type)
        assert.equal(result[0].name, endpoint.type, `endpoint type ${endpoint.type} equal`)
        assert.equal(result[0].value, endpoint.value, 'endpoint values match')
        assert.equal(result[0].isActive, 1, 'isActive flag match')
      }
      assert.end()
    } catch (err) {
      Logger.error(`get endpoint failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('getAllEndpoints', async (assert) => {
    try {
      const result = await ParticipantService.getAllEndpoints(participantFixtures[0].name)
      assert.comment('First endpoint')
      assert.equal(result[0].name, endpointsFixtures[0].type, 'endpoint types are equal')
      assert.equal(result[0].value, endpointsFixtures[0].value, 'endpoint values match')
      assert.equal(result[0].isActive, 1, 'isActive flag match')

      assert.comment('Second endpoint')
      assert.equal(result[1].name, endpointsFixtures[1].type, 'endpoint types are equal')
      assert.equal(result[1].value, endpointsFixtures[1].value, 'endpoint values match')
      assert.equal(result[1].isActive, 1, 'isActive flag match')

      assert.end()
    } catch (err) {
      Logger.error(`getAllEndpoints failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroyParticipantEndpointByName', async (assert) => {
    try {
      if (participantFixtures[0].name === testData.fsp1Name) {
        assert.pass(`endpoints for ${testData.fsp1Name} preserved`)
      } else {
        const result = await ParticipantEndpointHelper.deletePreparedData(participantFixtures[0].name)
        assert.ok(result, `destroy endpoint for ${participantFixtures[0].name} success`)
      }
      if (participantFixtures[1].name === testData.fsp2Name) {
        assert.pass(`endpoints for ${testData.fsp2Name} preserved`)
      } else {
        const result = await ParticipantEndpointHelper.deletePreparedData(participantFixtures[1].name)
        assert.ok(result, `destroy endpoint for ${participantFixtures[0].name} success`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`destroyParticipantEndpointByName failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('add participant limit and initial position', async (assert) => {
    try {
      let result = await ParticipantLimitHelper.prepareLimitAndInitialPosition(participantFixtures[0].name, { limit: { value: 111 } })
      assert.ok(result, `addLimitAndInitialPosition successful for participant: ${participantFixtures[0].name}`)
      result = await ParticipantLimitHelper.prepareLimitAndInitialPosition(participantFixtures[1].name, { limit: { value: 1000 } })
      assert.ok(result, `addLimitAndInitialPosition successful for participant: ${participantFixtures[1].name}`)
      result = await ParticipantLimitHelper.prepareLimitAndInitialPosition(participantFixtures[2].name, { limit: { value: 1000 } })
      assert.ok(result, `addLimitAndInitialPosition successful for participant: ${participantFixtures[2].name}`)
      result = await ParticipantLimitHelper.prepareLimitAndInitialPosition(participantFixtures[3].name, { limit: { value: 1000 } })
      assert.ok(result, `addLimitAndInitialPosition successful for participant: ${participantFixtures[3].name}`)
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`add participant limit and initial position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update limits', async (assert) => {
    try {
      const result = await ParticipantLimitHelper.adjustLimits(participantFixtures[0].name, { limit: { value: 1000 } })
      assert.ok(result, `adjustLimits successful for Participant: ${participantFixtures[0].name}`)
      assert.equal(result.participantLimit.value, 1000, 'The limits updated successfully')
      assert.end()
    } catch (err) {
      console.log(err)
      Logger.error(`update participant limit failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('get participant position', async (assert) => {
    try {
      const result = await ParticipantService.getPositions(participantFixtures[0].name, participantFixtures[0].currencyList[0].currencyId)
      assert.equal(result[0].currency, participantFixtures[0].currencyList[0].currencyId, 'currencies are equal')
      assert.equal(new MLNumber(result[0].value).toNumber(), 0, 'position value match')
      assert.end()
    } catch (err) {
      Logger.error(`get positions failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroy participant position', async (assert) => {
    try {
      if (participantFixtures[0].name === testData.fsp1Name) {
        assert.pass(`participant position for ${testData.fsp1Name} preserved`)
      } else {
        const result = await ParticipantLimitHelper.deleteInitialPositionData(participantFixtures[0].name)
        assert.ok(result, `destroy participant position for ${participantFixtures[0].name} success`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant position failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('destroy participant limits', async (assert) => {
    try {
      if (participantFixtures[0].name === testData.fsp1Name) {
        assert.pass(`participant limits for ${testData.fsp1Name} preserved`)
      } else {
        const result = await ParticipantLimitHelper.deleteInitialLimitData(participantFixtures[0].name)
        assert.ok(result, `destroy participant limits for ${participantFixtures[0].name} success`)
      }
      assert.end()
    } catch (err) {
      Logger.error(`destroy participant limits failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('update', async (assert) => {
    try {
      for (const participantId of participantMap.keys()) {
        const participant = await ParticipantService.update(participantMap.get(participantId).name, { isActive: 0 })
        let p = await ParticipantService.getById(participant.participantId)
        assert.equal(participant.participantId, p.participantId, 'ids match')
        assert.equal(p.isActive, 0, 'update works')
        await ParticipantService.update(participantMap.get(participantId).name, { isActive: 1 })
        p = await ParticipantService.getById(participant.participantId)
        assert.equal(p.isActive, 1, 'participant re-activated')
      }
      assert.end()
    } catch (err) {
      Logger.error(`update participant failed with error - ${err}`)
      assert.fail()
      assert.end()
    }
  })

  await participantTest.test('create participant with proxy', async (assert) => {
    try {
      const getByNameResult = await ParticipantService.getByName(testData.proxyParticipant)
      const result = await ParticipantHelper.prepareData(testData.proxyParticipant, testData.currency, undefined, !!getByNameResult, true)
      participantProxyFixtures.push(result.participant)

      for (const participant of participantProxyFixtures) {
        const read = await ParticipantService.getById(participant.participantId)
        participantMap.set(participant.participantId, read)
        if (debug) assert.comment(`Testing with participant \n ${JSON.stringify(participant, null, 2)}`)
        assert.equal(read.name, participant.name, 'names are equal')
        assert.deepEqual(read.currencyList, participant.currencyList, 'currency match')
        assert.equal(read.isActive, participant.isActive, 'isActive flag matches')
        assert.equal(read.createdDate.toString(), participant.createdDate.toString(), 'created date matches')
        assert.equal(read.isProxy, 1, 'isProxy flag set to true')
      }
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
