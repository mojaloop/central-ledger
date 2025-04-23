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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const Model = require('../../../dist/domain/settlement')
const Enums = require('../../../dist/lib/enumCached')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Db = require('../../../dist/lib/db')
const Cache = require('../../../dist/lib/cache')
const ProxyCache = require('../../../dist/lib/proxyCache')
const ParticipantCached = require('../../../dist/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../dist/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../dist/models/participant/participantLimitCached')
const SettlementModelCached = require('../../../dist/models/settlement/settlementModelCached')
const Config = require('../../../dist/lib/config')

const settlementModels = [
  {
    name: 'DEFERREDNETUSD',
    settlementGranularity: 'NET',
    settlementInterchange: 'MULTILATERAL',
    settlementAccountType: 'SETTLEMENT',
    settlementDelay: 'DEFERRED',
    ledgerAccountType: 'POSITION',
    autoPositionReset: true,
    currency: 'USD',
    requireLiquidityCheck: true
  },
  {
    name: 'DEFERREDNET',
    settlementGranularity: 'NET',
    settlementInterchange: 'MULTILATERAL',
    settlementAccountType: 'SETTLEMENT',
    settlementDelay: 'DEFERRED',
    ledgerAccountType: 'POSITION',
    autoPositionReset: true,
    requireLiquidityCheck: true
  }
]

exports.prepareData = async () => {
  await Db.connect(Config.DATABASE)
  await ProxyCache.connect()
  await Enums.initialize()
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await SettlementModelCached.initialize()
  await Cache.initCache()

  try {
    const settlementModelUSDExists = await Model.getByName(settlementModels[0].name)
    const settlementModelDefaultExists = await Model.getByName(settlementModels[0].name)
    if (!settlementModelUSDExists) {
      await Model.createSettlementModel(settlementModels[0])
    }
    if (!settlementModelDefaultExists) {
      await Model.createSettlementModel(settlementModels[1])
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
