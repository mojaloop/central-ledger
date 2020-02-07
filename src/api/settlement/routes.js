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

 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/

'use strict'

const Handler = require('./handler')
const Joi = require('@hapi/joi')
const currencyList = require('../../../seeds/currency.js').currencyList
const settlementGranularityList = require('../../../seeds/settlementGranularity.js').settlementGranularityList
const settlementInterchangeList = require('../../../seeds/settlementInterchange.js').settlementInterchangeList
const settlementDelayList = require('../../../seeds/settlementDelay.js').settlementDelayList
const ledgerAccountList = require('../../../seeds/ledgerAccountType.js').ledgerAccountList
const tags = ['api', 'settlement']

module.exports = [
  {
    method: 'POST',
    path: '/settlementModel',
    handler: Handler.create,
    options: {
      tags,
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: Joi.object({
          name: Joi.string().alphanum().min(2).max(30).required().description('Name of the settlement model'),
          settlementGranularity: Joi.string().required().valid(...settlementGranularityList).description('Granularity type for the settlement model GROSS or NET'),
          settlementInterchange: Joi.string().required().valid(...settlementInterchangeList).description('Interchange type for the settlement model BILATERAL or MULTILATERAL'),
          settlementDelay: Joi.string().required().valid(...settlementDelayList).description('Delay type for the settlement model IMMEDIATE or DEFERRED'),
          currency: Joi.string().valid(...currencyList).description('Currency code'),
          requireLiquidityCheck: Joi.boolean().required().description('Liquidity Check boolean'),
          ledgerAccountType: Joi.string().required().valid(...ledgerAccountList).description('Account type for the settlement model POSITION, SETTLEMENT or INTERCHANGE_FEE')
        })
      }
    }
  }
]
