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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const currencyList = require('../../../seeds/currency.js').currencyList

const tags = ['api', 'participants']
const nameValidator = Joi.string().alphanum().min(2).max(30).required().description('Name of the participant')
const currencyValidator = Joi.string().valid(currencyList).description('Currency code')
// const passwordValidator = Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the participant')

/* The following code is used to compare the currency lists: fspiop-rest-v1.0-OpenAPI.yaml vs. seeds/currency.js */
// const currenciesSpec = ['AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GGP', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRO', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLL', 'SOS', 'SPL', 'SRD', 'STD', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VEF', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XDR', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWD']
// currenciesSpec.forEach(value => {
//   if (currencyList.indexOf(value) === -1) {
//     console.log(`seeds is missing ${value}`)
//   }
// })
// currencyList.forEach(value => {
//   if (currenciesSpec.indexOf(value) === -1) {
//     console.error(`spec is missing ${value}`)
//   }
// })

module.exports = [
  {
    method: 'GET',
    path: '/participants',
    handler: Handler.getAll,
    options: {
      tags
    }
  },
  {
    method: 'GET',
    path: '/participants/{name}',
    handler: Handler.getByName,
    options: {
      tags,
      validate: {
        params: {
          name: Joi.string().required().description('Participant name')
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants',
    handler: Handler.create,
    options: {
      tags,
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          name: nameValidator,
          // password: passwordValidator,
          currency: currencyValidator // ,
          // emailAddress: Joi.string().email().required()
        }
      }
    }
  },
  {
    method: 'PUT',
    path: '/participants/{name}',
    handler: Handler.update,
    options: {
      tags,
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          isActive: Joi.boolean().required().description('Participant isActive boolean')
        },
        params: {
          name: Joi.string().required().description('Participant name')
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants/{name}/endpoints',
    handler: Handler.addEndpoint,
    options: {
      id: 'participants_endpoints_add',
      tags: tags,
      description: 'Add/Update participant endpoints',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          type: Joi.string().required().description('Endpoint Type'),
          value: Joi.string().required().description('Endpoint Value')
        },
        params: {
          name: nameValidator
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/participants/{name}/endpoints',
    handler: Handler.getEndpoint,
    options: {
      id: 'participants_endpoints_get',
      tags: tags,
      description: 'View participant endpoints',
      validate: {
        params: {
          name: nameValidator
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants/{name}/initialPositionAndLimits',
    handler: Handler.addLimitAndInitialPosition,
    options: {
      id: 'participants_limits_pos_add',
      tags: tags,
      description: 'Add initial participant limits and position',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          currency: currencyValidator,
          limit: Joi.object().keys({
            type: Joi.string().required().description('Limit Type'),
            value: Joi.number().positive().allow(0).required().description('Limit Value')
          }).required().description('Participant Limit'),
          initialPosition: Joi.number().optional().description('Initial Position Value')
        },
        params: {
          name: nameValidator
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/participants/{name}/limits',
    handler: Handler.getLimits,
    options: {
      id: 'participants_limits_get',
      tags: tags,
      description: 'View participant limits',
      validate: {
        params: {
          name: nameValidator
        },
        query: {
          currency: currencyValidator,
          type: Joi.string().optional().description('Limit Type')
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants/{name}/limits',
    handler: Handler.adjustLimits,
    options: {
      id: 'participants_limits_adjust',
      tags: tags,
      description: 'Adjust participant limits',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          currency: currencyValidator,
          limit: Joi.object().keys({
            type: Joi.string().required().description('Limit Type'),
            value: Joi.number().required().description('Limit Value')
          }).required().description('Participant Limit')
        },
        params: {
          name: nameValidator
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants/{name}/accounts',
    handler: Handler.createHubAccount,
    options: {
      id: 'hub_accounts_create',
      tags: tags,
      description: 'Create hub accounts',
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          currency: currencyValidator,
          type: Joi.string().required().description('Account type')  // Needs a validator here
        },
        params: {
          name: Joi.string().required().description('Participant name') // nameValidator
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/participants/{name}/positions',
    handler: Handler.getPositions,
    options: {
      id: 'participants_positions_get',
      tags: tags,
      description: 'View participant positions',
      validate: {
        params: {
          name: nameValidator
        },
        query: {
          currency: currencyValidator
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/participants/{name}/accounts',
    handler: Handler.getAccounts,
    options: {
      id: 'participants_accounts_get',
      tags: tags,
      description: 'View participant accounts balances',
      validate: {
        params: {
          name: nameValidator
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/participants/{name}/accounts/{id}',
    handler: Handler.recordFunds,
    options: {
      id: 'post_participants_accounts_funds',
      tags: tags,
      description: 'Record Funds In or Out of participant account',
      validate: {
        payload: {
          transferId: Joi.string().guid().required(),
          externalReference: Joi.string().required(),
          action: Joi.string().required().valid([ 'recordFundsOutPrepare', 'recordFundsIn' ]).label('action is missing or not supported'),
          reason: Joi.string().required(),
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
        },
        params: {
          name: nameValidator,
          id: Joi.number().integer().positive()
        }
      }
    }
  },
  {
    method: 'PUT',
    path: '/participants/{name}/accounts/{id}/transfers/{transferId}',
    handler: Handler.recordFunds,
    options: {
      id: 'put_participants_accounts_funds',
      tags: tags,
      description: 'Record Funds In or Out of participant account',
      validate: {
        payload: {
          action: Joi.string().valid([ 'recordFundsOutCommit', 'recordFundsOutAbort' ]).label('action is missing or not supported'),
          reason: Joi.string().required()
        },
        params: {
          name: nameValidator,
          id: Joi.number().integer().positive(),
          transferId: Joi.string().guid().required()
        }
      }
    }
  }
]
