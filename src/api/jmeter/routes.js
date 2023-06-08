/* istanbul ignore file */

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

 * Coil
 *  - Jason Bruwer <jason.bruwer@coil.com>
 --------------
 ******/
'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const { currencyList } = require('../../../seeds/currency')
const tags = ['api', 'jmeter']

const nameValidator = Joi.string().alphanum().min(2).max(30).required().description('Name of the participant')
const currencyValidator = Joi.string().valid(...currencyList).description('Currency code')

module.exports = [
  {
    method: 'GET',
    path: '/jmeter/transactions/ilp/{id}',
    handler: Handler.getIlpTransactionById,
    options: {
      tags,
      description: '[jMeter] API used for retrieving a ILP transaction by id.',
      validate: {
        params: Joi.object({
          id: Joi.string().required().description('Transaction id')
        })
      }
    }
  },
  {
    method: 'GET',
    path: '/jmeter/participants/{name}/transfers/{id}',
    handler: Handler.getTransferById,
    options: {
      tags,
      description: '[jMeter] API used for retrieving a MJL transaction by id.',
      validate: {
        params: Joi.object({
          name: nameValidator,
          id: Joi.string().required().description('Transfer id')
        })
      }
    }
  },
  {
    method: 'GET',
    path: '/jmeter/participants/{name}',
    handler: Handler.getTransferById,
    options: {
      tags,
      description: '[jMeter] API used for retrieving a MJL participant accounts and balances by id.',
      validate: {
        params: Joi.object({
          name: nameValidator
        })
      }
    }
  },
  {
    method: 'POST',
    path: '/jmeter/participants/create',
    handler: Handler.createParticipantAccounts,
    options: {
      tags,
      description: '[jMeter] API used for creating participant accounts.',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: Joi.object({
          name: Joi.string().required().description('Name is required'),
          currency: currencyValidator,
          newlyCreated: Joi.boolean().required().description('is this a newly created participant.')
        })
      }
    }
  },
  {
    method: 'POST',
    path: '/jmeter/transfers/prepare',
    handler: Handler.prepareTransfer,
    options: {
      tags,
      description: '[jMeter] API used for preparing a 2-phase transfer (optional fulfill may be provided).',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: Joi.object({
          fulfil: Joi.boolean().required().description('Should the fulfil operation also be performed.'),
          transferId: Joi.string().required(),
          payerFsp: Joi.string().required().description('Payer is required'),
          payeeFsp: Joi.string().required().description('Payee is required'),
          condition: Joi.string().required().description('Condition is required'),
          ilpPacket: Joi.string().required().description('ILPPacket is required'),
          expiration: Joi.string().required().description('Expiration is required'),
          amount: Joi.object({
            amount: Joi.number().positive().precision(4).required(),
            currency: currencyValidator
          }).required().label('No amount provided'),
          extensionList: Joi.object({
            extension: Joi.array().items({
              key: Joi.string(),
              value: Joi.string()
            })
          })
        })
      }
    }
  }
]
