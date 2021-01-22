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
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const currencyList = require('../../../seeds/currency.js').currencyList
const settlementGranularityList = require('../../../seeds/settlementGranularity.js').settlementGranularityList
const settlementInterchangeList = require('../../../seeds/settlementInterchange.js').settlementInterchangeList
const settlementDelayList = require('../../../seeds/settlementDelay.js').settlementDelayList
const tags = ['api', 'settlement']

module.exports = [
  {
    method: 'GET',
    path: '/settlementModels',
    handler: Handler.getAll,
    options: {
      tags
    }
  },
  {
    method: 'GET',
    path: '/settlementModels/{name}',
    handler: Handler.getByName,
    options: {
      tags,
      validate: {
        params: Joi.object({
          name: Joi.string().required().description('SettlementModel name')
        })
      }
    }
  },
  {
    method: 'POST',
    path: '/settlementModels',
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
          currency: Joi.string().required().valid(...currencyList).description('Currency code'),
          requireLiquidityCheck: Joi.boolean().required().description('Liquidity Check boolean'),
          ledgerAccountType: Joi.string().required().description('Account type for the settlement model'),
          autoPositionReset: Joi.boolean().required().description('Automatic position reset setting, which determines whether to execute the settlement transfer or not'),
          settlementAccountType: Joi.string().valid('SETTLEMENT', 'INTERCHANGE_FEE_SETTLEMENT').required().description('Settlement account linked to the ledger account')
        })
      }
    }
  },
  {
    method: 'PUT',
    path: '/settlementModels/{name}',
    handler: Handler.update,
    options: {
      tags,
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: Joi.object({
          isActive: Joi.boolean().required().description('settlementModel isActive boolean')
        }),
        params: Joi.object({
          name: Joi.string().required().description('settlementModel name')
        })
      }
    }
  }
]
