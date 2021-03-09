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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Valentin Genev <valentin.genev@modusbox.com>
 - Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 - Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 - Rajiv Mothilal <rajiv.mothilal@modusbox.com>
 --------------
 ******/

'use strict'

const Model = require('../../../src/domain/settlement')
const Enums = require('../../../src/lib/enumCached')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Db = require('@mojaloop/central-services-database').Db
const Cache = require('../../../src/lib/cache')
const ParticipantCached = require('../../../src/models/participant/participantCached')
const ParticipantCurrencyCached = require('../../../src/models/participant/participantCurrencyCached')
const ParticipantLimitCached = require('../../../src/models/participant/participantLimitCached')
const SettlementModelCached = require('../../../src/models/settlement/settlementModelCached')
const Config = require('../../../src/lib/config')

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
  }
]

exports.prepareData = async () => {
  await Db.connect(Config.DATABASE)
  await Enums.initialize()
  await ParticipantCached.initialize()
  await ParticipantCurrencyCached.initialize()
  await ParticipantLimitCached.initialize()
  await SettlementModelCached.initialize()
  await Cache.initCache()

  try {
    await Model.createSettlementModel(settlementModels[0])
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
