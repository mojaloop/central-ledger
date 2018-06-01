const Handler = require('./handler')
const Joi = require('joi')
const Auth = require('../auth')

const tags = ['api', 'charge']

module.exports = [
  {
    method: 'POST',
    path: '/charge/quote',
    handler: Handler.chargeQuote,
    options: {
      id: 'charge',
      tags: tags,
      auth: Auth.strategy(),
      description: 'Quote a charge for a transaction amount',
      payload: {
        allow: 'application/json',
        failAction: 'error'
      },
      validate: {
        payload: {
          amount: Joi.number().required().description('Amount for charge quote')
        }
      }
    }
  }
]
