const Handler = require('./handler')
const Joi = require('joi')
const Permissions = require('../../domain/security/permissions')
const RouteConfig = require('../route-config')
const tags = ['api', 'charge']

module.exports = [
  {
    method: 'GET',
    path: '/charge',
    handler: Handler.getAll,
    options: RouteConfig.config(tags, Permissions.CHARGE_LIST)
  },
  {
    method: 'POST',
    path: '/charge',
    handler: Handler.create,
    options: RouteConfig.config(tags, Permissions.CHARGE_CREATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          name: Joi.string().token().max(256).required().description('Name of the charge'),
          charge_type: Joi.string().required().valid('fee').description('Type of the charge'),
          rate_type: Joi.string().required().valid('percent', 'flat').description('Rate type of the charge'),
          rate: Joi.number().required().description('Rate for the charge'),
          minimum: Joi.number().optional().description('Minimum amount for the charge'),
          maximum: Joi.number().optional().description('Maximum amount for the charge'),
          code: Joi.string().token().max(256).required().description('Code for the charger'),
          is_active: Joi.boolean().required().description('Status for charge'),
          payerParticipantId: Joi.string().required().valid('sender', 'receiver', 'ledger').description('Payer of the charged fee'),
          payeeParticipantId: Joi.string().required().valid('sender', 'receiver', 'ledger').description('Payee of the charged fee')
        }
      }
    })
  },
  {
    method: 'PUT',
    path: '/charge/{name}',
    handler: Handler.update,
    options: RouteConfig.config(tags, Permissions.CHARGE_UPDATE, {
      payload: {
        allow: ['application/json'],
        failAction: 'error'
      },
      validate: {
        payload: {
          name: Joi.string().token().max(256).optional().description('Name of the charge'),
          charge_type: Joi.string().optional().valid('fee').description('Type of the charge'),
          minimum: Joi.number().optional().allow(null).description('Minimum amount for the charge'),
          maximum: Joi.number().optional().allow(null).description('Maximum amount for the charge'),
          code: Joi.string().token().max(256).optional().allow(null).description('Code for the charger'),
          is_active: Joi.boolean().optional().description('Status for charge')
        },
        params: {
          name: Joi.string().required().description('Charge name')
        }
      }
    })
  }
]

