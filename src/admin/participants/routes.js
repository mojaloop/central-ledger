'use strict'

const Handler = require('./handler')
const Joi = require('joi')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')

const tags = ['api', 'participants']
const nameValidator = Joi.string().alphanum().min(3).max(30).required().description('Name of the participant')
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
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_LIST)
  },
  {
    method: 'GET',
    path: '/participants/{name}',
    handler: Handler.getByName,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_VIEW, {
      params: {
        name: Joi.string().required().description('Participant name')
      }
    })
  },
  {
    method: 'POST',
    path: '/participants',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_CREATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          name: nameValidator,
//          password: passwordValidator,
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
    options: RouteConfig.config(tags, Permissions.ACCOUNTS_UPDATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          is_disabled: Joi.boolean().required().description('Participant is_disabled boolean')
        },
        params: {
          name: Joi.string().required().description('Participant name')
        }
      }
    })
  }
]
