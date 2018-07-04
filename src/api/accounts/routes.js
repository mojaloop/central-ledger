const Handler = require('./handler')
const Joi = require('joi')
const Auth = require('../auth')
// const Boom = require('boom')

const tags = ['api', 'accounts']
const nameValidator = Joi.string().alphanum().min(3).max(30).required().description('Name of the account')
const passwordValidator = Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the account')
// const emailAddressValidator = Joi.string().email()

module.exports = [{
  method: 'POST',
  path: '/accounts',
  handler: Handler.create,
  options: {
    id: 'accounts',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Create an account.',
    payload: {
      allow: 'application/json',
      failAction: 'error',
      output: 'data'
    },
    validate: {
      payload: {
        name: Joi.string().alphanum().min(3).max(30).required().description('Name of the account'),
        password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the account'),
        emailAddress: Joi.string().email().required()
      }
    }
  }
},
{
  method: 'GET',
  path: '/accounts/{name}',
  handler: Handler.getByName,
  options: {
    id: 'account',
    tags: tags,
    description: 'Retrieve an accounts details by name',
    auth: Auth.strategy(true),
    validate: {
      params: {
        name: nameValidator
      }
    }
  }
},
{
  method: 'PUT',
  path: '/accounts/{name}',
  handler: Handler.updateUserCredentials,
  options: {
    id: 'account_update_user_credentials',
    tags: tags,
    description: 'Update an accounts user credentials',
    auth: Auth.strategy(),
    payload: {
      allow: 'application/json',
      failAction: 'error'
    },
    validate: {
      params: {
        name: nameValidator
      },
      payload: {
        password: passwordValidator,
        emailAddress: Joi.string().email().required()
      }
    }
  }
},
{
  method: 'PUT',
  path: '/accounts/{name}/settlement',
  handler: Handler.updateAccountSettlement,
  options: {
    id: 'account_update_account_settlement',
    tags: tags,
    description: 'Update an accounts user credentials',
    auth: Auth.strategy(),
    payload: {
      allow: 'application/json',
      failAction: 'error'
    },
    validate: {
      params: {
        name: nameValidator
      },
      payload: {
        account_number: Joi.string().token().max(16).required().description('Account number for the settlement'),
        routing_number: Joi.string().token().max(16).required().description('Routing number for the settlement')
      }
    }
  }
}
]
