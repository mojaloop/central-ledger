const Handler = require('./handler')
 const Joi = require('joi')
const Auth = require('../auth')

const tags = ['api', 'kafka']
/* const tags = ['api', 'accounts']
const nameValidator = Joi.string().token().max(256).required().description('Name of the account')
const passwordValidator = Joi.string().token().max(256).required().description('Password for the account')
const emailAddressValidator = Joi.string().email() */

module.exports = [{
  method: 'POST',
  path: '/kafka',
  handler: Handler.create,
  config: {
    id: 'kafka',
    tags: tags,
/*
    auth: Auth.strategy(),
*/
    description: 'Create a consumer.',
    validate: {
      payload: {
        account: Joi.string().uri().required().description('Account')
      }
    }
  }
}
]
