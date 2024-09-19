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

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

const { randomUUID } = require('node:crypto')
const Test = require('tape')

const prepareHandler = require('#src/handlers/transfers/prepare')
const config = require('#src/lib/config')
const Db = require('#src/lib/db')
const proxyCache = require('#src/lib/proxyCache')
const Cache = require('#src/lib/cache')
const externalParticipantCached = require('#src/models/participant/externalParticipantCached')
const ParticipantCached = require('#src/models/participant/participantCached')
const ParticipantCurrencyCached = require('#src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('#src/models/participant/participantLimitCached')
const transferFacade = require('#src/models/transfer/facade')

const participantHelper = require('#test/integration/helpers/participant')
const fixtures = require('#test/fixtures')
const { tryCatchEndTest } = require('#test/util/helpers')

Test('Prepare Handler internals Tests -->', (prepareHandlerTest) => {
  const initiatingFsp = `externalPayer-${Date.now()}`
  const counterPartyFsp = `externalPayee-${Date.now()}`
  const proxyId1 = `proxy1-${Date.now()}`
  const proxyId2 = `proxy2-${Date.now()}`

  const curr1 = 'BWP'
  // const curr2 = 'TZS';

  const transferId = randomUUID()

  prepareHandlerTest.test('setup', tryCatchEndTest(async (t) => {
    await Db.connect(config.DATABASE)
    await proxyCache.connect()
    await Promise.all([
      externalParticipantCached.initialize(),
      ParticipantCached.initialize(),
      ParticipantCurrencyCached.initialize(),
      ParticipantLimitCached.initialize(),
      Cache.initCache()
    ])

    const [proxy1, proxy2] = await Promise.all([
      participantHelper.prepareData(proxyId1, curr1, null, false, true),
      participantHelper.prepareData(proxyId2, curr1, null, false, true)
    ])
    t.ok(proxy1, 'proxy1 is created')
    t.ok(proxy2, 'proxy2 is created')

    await Promise.all([
      ParticipantCurrencyCached.update(proxy1.participantCurrencyId, true),
      ParticipantCurrencyCached.update(proxy1.participantCurrencyId2, true)
    ])
    t.pass('proxy1 currencies are activated')

    const [isPayerAdded, isPayeeAdded] = await Promise.all([
      proxyCache.getCache().addDfspIdToProxyMapping(initiatingFsp, proxyId1),
      proxyCache.getCache().addDfspIdToProxyMapping(counterPartyFsp, proxyId2)
    ])
    t.ok(isPayerAdded, 'payer is added to proxyCache')
    t.ok(isPayeeAdded, 'payee is added to proxyCache')

    t.pass('setup is done')
  }))

  prepareHandlerTest.test('should create proxyObligation for inter-scheme fxTransfer', tryCatchEndTest(async (t) => {
    const payload = fixtures.fxTransferDto({ initiatingFsp, counterPartyFsp })
    const isFx = true

    const obligation = await prepareHandler.calculateProxyObligation({
      payload,
      isFx,
      params: {},
      functionality: 'functionality',
      action: 'action'
    })
    t.equals(obligation.isFx, isFx)
    t.equals(obligation.initiatingFspProxyOrParticipantId.inScheme, false)
    t.equals(obligation.initiatingFspProxyOrParticipantId.proxyId, proxyId1)
    t.equals(obligation.initiatingFspProxyOrParticipantId.name, initiatingFsp)
    t.equals(obligation.counterPartyFspProxyOrParticipantId.inScheme, false)
    t.equals(obligation.counterPartyFspProxyOrParticipantId.proxyId, proxyId2)
    t.equals(obligation.counterPartyFspProxyOrParticipantId.name, counterPartyFsp)
  }))

  prepareHandlerTest.test('should save preparedRequest for inter-scheme transfer, and create external participants', tryCatchEndTest(async (t) => {
    let [extPayer, extPayee] = await Promise.all([
      externalParticipantCached.getByName(initiatingFsp),
      externalParticipantCached.getByName(counterPartyFsp)
    ])
    t.equals(extPayer, undefined)
    t.equals(extPayee, undefined)

    const isFx = false
    const payload = fixtures.transferDto({
      transferId,
      payerFsp: initiatingFsp,
      payeeFsp: counterPartyFsp
    })
    const proxyObligation = fixtures.mockProxyObligationDto({
      isFx,
      payloadClone: payload,
      proxy1: proxyId1,
      proxy2: proxyId2
    })
    const determiningTransferCheckResult = {
      determiningTransferExistsInTransferList: null,
      watchListRecords: [],
      participantCurrencyValidationList: []
    }

    await prepareHandler.checkDuplication({
      isFx,
      payload,
      ID: transferId,
      location: {}
    })
    await prepareHandler.savePreparedRequest({
      isFx,
      payload,
      validationPassed: true,
      reasons: [],
      functionality: 'functionality',
      params: {},
      location: {},
      determiningTransferCheckResult,
      proxyObligation
    })

    const dbTransfer = await transferFacade.getByIdLight(payload.transferId)
    t.ok(dbTransfer, 'transfer is saved')
    t.equals(dbTransfer.transferId, transferId, 'dbTransfer.transferId')

    ;[extPayer, extPayee] = await Promise.all([
      externalParticipantCached.getByName(initiatingFsp),
      externalParticipantCached.getByName(counterPartyFsp)
    ])
    t.ok(extPayer)
    t.ok(extPayee)

    const [participant1] = await transferFacade.getTransferParticipant(proxyId1, transferId)
    t.equals(participant1.externalParticipantId, extPayer.externalParticipantId)
    t.equals(participant1.participantId, extPayer.proxyId)
  }))

  prepareHandlerTest.test('teardown', tryCatchEndTest(async (t) => {
    await Promise.all([
      Db.disconnect(),
      proxyCache.disconnect(),
      Cache.destroyCache()
    ])
    t.pass('connections are closed')
  }))

  prepareHandlerTest.end()
})
