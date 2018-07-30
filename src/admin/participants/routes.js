'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../routeConfig')

const tags = ['api', 'participants']
const nameValidator = Joi.string().alphanum().min(2).max(30).required().description('Name of the participant')
// const passwordValidator = Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the participant')
const currencyValidator = Joi.string().allow([
  'ALL', 'AFN', 'ARS', 'AWG', 'AUD', 'AZN',
  'BSD', 'BBD', 'BYN', 'BZD', 'BMD', 'BOB', 'BAM', 'BWP', 'BGN', 'BRL', 'BND',
  'KHR', 'CAD', 'KYD', 'CLP', 'CNY', 'COP', 'CRC', 'HRK', 'CUP', 'CZK',
  'DKK', 'DOP',
  'XCD', 'EGP', 'SVC', 'EUR',
  'FKP', 'FJD',
  'GHS', 'GIP', 'GTQ', 'GGP', 'GYD',
  'HNL', 'HKD', 'HUF',
  'ISK', 'INR', 'IDR', 'IRR', 'IMP', 'ILS',
  'JMD', 'JPY', 'JEP',
  'KZT', 'KPW', 'KRW', 'KGS',
  'LAK', 'LBP', 'LRD',
  'MKD', 'MYR', 'MUR', 'MXN', 'MNT', 'MZN',
  'NAD', 'NPR', 'ANG', 'NZD', 'NIO', 'NGN', 'KPW', 'NOK',
  'OMR',
  'PKR', 'PAB', 'PYG', 'PEN', 'PHP', 'PLN',
  'QAR',
  'RON', 'RUB',
  'SHP', 'SAR', 'RSD', 'SCR', 'SGD', 'SBD', 'SOS', 'ZAR', 'KRW', 'LKR', 'SEK', 'CHF', 'SRD', 'SYP',
  'TWD', 'THB', 'TTD', 'TRY', 'TVD',
  'UAH', 'GBP', 'USD', 'UYU', 'UZS',
  'VEF', 'VND',
  'YER',
  'ZWD'
]).description('Currency code of the participant')

module.exports = [
  {
    method: 'GET',
    path: '/participants',
    handler: Handler.getAll,
    options: RouteConfig.config(tags, Permissions.PARTICIPANTS_LIST)
  },
  {
    method: 'GET',
    path: '/participants/{name}',
    handler: Handler.getByName,
    options: RouteConfig.config(tags, Permissions.PARTICIPANTS_VIEW, {
      params: {
        name: Joi.string().required().description('Participant name')
      }
    })
  },
  {
    method: 'POST',
    path: '/participants',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.PARTICIPANTS_CREATE, {
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
    })
  },
  {
    method: 'PUT',
    path: '/participants/{name}',
    handler: Handler.update,
    options: RouteConfig.config(tags, Permissions.PARTICIPANTS_UPDATE, {
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
    })
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
            value: Joi.number().required().description('Limit Value')
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
  }
]
