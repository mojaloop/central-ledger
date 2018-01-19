const Handler = require('./handler')
const Joi = require('joi')
const Auth = require('../auth')

const tags = ['api', 'accounts']
const nameValidator = Joi.string().token().max(256).required().description('Name of the account')
const passwordValidator = Joi.string().token().max(256).required().description('Password for the account')
const emailAddressValidator = Joi.string().email()

module.exports = [{
  method: 'POST',
  path: '/accounts',
  handler: Handler.create,
  config: {
    id: 'accounts',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Create an account.',
    validate: {
      payload: {
        name: nameValidator,
        password: passwordValidator,
        emailAddress: emailAddressValidator
      }
    }
  }
},
{
  method: 'GET',
  path: '/accounts/{name}',
  handler: Handler.getByName,
  config: {
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
  config: {
    id: 'account_update_user_credentials',
    tags: tags,
    description: 'Update an accounts user credentials',
    auth: Auth.strategy(),
    validate: {
      params: {
        name: nameValidator
      },
      payload: {
        password: passwordValidator
      }
    }
  }
},
{
  method: 'PUT',
  path: '/accounts/{name}/settlement',
  handler: Handler.updateAccountSettlement,
  config: {
    id: 'account_update_account_settlement',
    tags: tags,
    description: 'Update an accounts user credentials',
    auth: Auth.strategy(),
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
