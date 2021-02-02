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
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const Handler = require('./handler')
const Joi = require('@hapi/joi')
const tags = ['api', 'ledgerAccountTypes']

module.exports = [
  {
    method: 'GET',
    path: '/ledgerAccountTypes',
    handler: Handler.getAll,
    options: {
      tags,
      description: 'Get all ledger Account types'

    }
  },
  {
    method: 'POST',
    path: '/ledgerAccountTypes',
    handler: Handler.create,
    options: {
      tags,
      description: 'Create a new ledger account type',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: Joi.object({
          name: Joi.string().min(2).max(30).pattern(/^\w+$/).required().description('Name of the ledger account type'),
          description: Joi.string().required().description('The description of the ledger account type'),
          isActive: Joi.boolean().required().description('Determines whether this ledger account type is active or not'),
          isSettleable: Joi.boolean().required().description('Determines whether this ledger account type is settleable or not')
        })
      }
    }
  }
]
