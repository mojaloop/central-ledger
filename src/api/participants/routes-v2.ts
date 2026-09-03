import { ReqRefDefaults, ServerRoute } from "@hapi/hapi";
import HandlerV2 from "./handler-v2";

const Joi = require('joi')
const currencyList = require('../../seeds/currency.js').currencyList

const tags = ['api', 'participants']

const nameValidator = Joi.string().required()
  .min(2)
  .max(30)
  .description('Name of the participant')
const currencyValidator = Joi.string()
  .valid(...currencyList)
  .description('Currency code')


const buildRoutes = (handler: HandlerV2) => {
  return [
    {
      method: 'GET',
      path: '/participants',
      handler: handler.getAll.bind(handler),
      options: {
        tags
      }
    },
    {
      method: 'GET',
      path: '/participants/{name}',
      handler: handler.getByName.bind(handler),
      options: {
        tags,
        validate: {
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'POST',
      path: '/participants',
      handler: handler.create.bind(handler),
      options: {
        tags,
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            name: nameValidator,
            // password: passwordValidator,
            currency: currencyValidator,
            isProxy: Joi.boolean().falsy(0, '0', '').truthy(1, '1').allow(true, false, 0, 1, '0', '1', null)
            // emailAddress: Joi.string().email().required()
          })
        }
      }
    },
    {
      method: 'PUT',
      path: '/participants/{name}',
      handler: handler.update.bind(handler),
      options: {
        tags,
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            isActive: Joi.boolean().required().description('Participant isActive boolean')
          }),
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'POST',
      path: '/participants/{name}/endpoints',
      handler: handler.addEndpoint.bind(handler),
      options: {
        id: 'participants_endpoints_add',
        tags,
        description: 'Add/Update participant endpoints',
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            type: Joi.string().required().description('Endpoint Type'),
            value: Joi.string().required().description('Endpoint Value')
          }),
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'GET',
      path: '/participants/{name}/endpoints',
      handler: handler.getEndpoint.bind(handler),
      options: {
        id: 'participants_endpoints_get',
        tags,
        description: 'View participant endpoints',
        validate: {
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'POST',
      path: '/participants/{name}/initialPositionAndLimits',
      handler: handler.addLimitAndInitialPosition.bind(handler),
      options: {
        id: 'participants_limits_pos_add',
        tags,
        description: 'Add initial participant limits and position',
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            currency: currencyValidator,
            limit: Joi.object().keys({
              type: Joi.string().required().description('Limit Type'),
              value: Joi.number().positive().allow(0).required().description('Limit Value'),
              alarmPercentage: Joi.number().required().description('limit threshold alarm percentage value')
            }).required().description('Participant Limit'),
            initialPosition: Joi.number().optional().description('Initial Position Value')
          }),
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'GET',
      path: '/participants/{name}/limits',
      handler: handler.getLimits.bind(handler),
      options: {
        id: 'participants_limits_get',
        tags,
        description: 'View participant limits',
        validate: {
          params: Joi.object({
            name: nameValidator
          }),
          query: Joi.object({
            currency: currencyValidator,
            type: Joi.string().optional().description('Limit Type')
          })
        }
      }
    },
    {
      method: 'GET',
      path: '/participants/limits',
      handler: handler.getLimitsForAllParticipants.bind(handler),
      options: {
        id: 'participants_limits_get_all',
        tags,
        description: 'View limits for all participants',
        validate: {
          query: Joi.object({
            currency: currencyValidator,
            type: Joi.string().optional().description('Limit Type')
          })
        }
      }
    },
    {
      method: 'PUT',
      path: '/participants/{name}/limits',
      handler: handler.adjustLimits.bind(handler),
      options: {
        id: 'participants_limits_adjust',
        tags,
        description: 'Adjust participant limits',
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            currency: currencyValidator,
            limit: Joi.object().keys({
              type: Joi.string().required().description('Limit Type'),
              value: Joi.number().required().description('Limit Value'),
              alarmPercentage: Joi.number().required().description('limit threshold alarm percentage value')
            }).required().description('Participant Limit')
          }),
          params: Joi.object({
            name: nameValidator
          })
        }
      }
    },
    {
      method: 'POST',
      path: '/participants/{name}/accounts',
      handler: handler.createHubAccount.bind(handler),
      options: {
        id: 'hub_accounts_create',
        tags,
        description: 'Create hub accounts',
        payload: {
          allow: ['application/json'],
          failAction: 'error'
        },
        validate: {
          payload: Joi.object({
            currency: currencyValidator,
            type: Joi.string().required().description('Account type') // Needs a validator here
          }),
          params: Joi.object({
            name: nameValidator // nameValidator
          })
        }
      }
    },
    {
      method: 'GET',
      path: '/participants/{name}/positions',
      handler: handler.getPositions.bind(handler),
      options: {
        id: 'participants_positions_get',
        tags,
        description: 'View participant positions',
        validate: {
          params: Joi.object({
            name: nameValidator
          }),
          query: Joi.object({
            currency: currencyValidator
          })
        }
      }
    },
    {
      method: 'GET',
      path: '/participants/{name}/accounts',
      handler: handler.getAccounts.bind(handler),
      options: {
        id: 'participants_accounts_get',
        tags,
        description: 'View participant accounts and balances',
        validate: {
          params: Joi.object({
            name: nameValidator
          }),
          query: Joi.object({
            currency: currencyValidator.optional()
          })
        }
      }
    },
    {
      method: 'PUT',
      path: '/participants/{name}/accounts/{id}',
      handler: handler.updateAccount.bind(handler),
      options: {
        id: 'participants_accounts_update',
        tags,
        description: 'Update participant accounts',
        validate: {
          payload: Joi.object({
            isActive: Joi.boolean().required().description('Participant currency isActive boolean')
          }),
          params: Joi.object({
            name: nameValidator,
            id: Joi.number().integer().positive()
          })
        }
      }
    },
    {
      method: 'POST',
      path: '/participants/{name}/accounts/{id}',
      handler: handler.recordFunds.bind(handler),
      options: {
        id: 'post_participants_accounts_funds',
        tags,
        description: 'Record Funds In or Out of participant account',
        validate: {
          payload: Joi.object({
            // Some tests still use uuid, so we need to support both uuid and ulid here for now
            transferId: Joi.string().pattern(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^[0-9A-HJKMNP-TV-Z]{26})$/).required(),
            externalReference: Joi.string().required(),
            action: Joi.string().required().valid('recordFundsIn', 'recordFundsOutPrepareReserve').label('action is missing or not supported'),
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
          }),
          params: Joi.object({
            name: nameValidator,
            id: Joi.number().integer().positive()
          })
        }
      }
    },
    {
      method: 'PUT',
      path: '/participants/{name}/accounts/{id}/transfers/{transferId}',
      handler: handler.recordFunds.bind(handler),
      options: {
        id: 'put_participants_accounts_funds',
        tags,
        description: 'Record Funds In or Out of participant account',
        validate: {
          payload: Joi.object({
            action: Joi.string().valid('recordFundsOutCommit', 'recordFundsOutAbort').label('action is missing or not supported'),
            reason: Joi.string().required()
          }),
          params: Joi.object({
            name: nameValidator,
            id: Joi.number().integer().positive(),
            // Some tests still use uuid, so we need to support both uuid and ulid here for now
            transferId: Joi.string().pattern(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^[0-9A-HJKMNP-TV-Z]{26})$/).required()
          })
        }
      }
    }
  ] as ServerRoute<ReqRefDefaults>[]
}

export default buildRoutes