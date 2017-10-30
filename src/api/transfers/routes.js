const Handler = require('./handler')
const Joi = require('joi')
const Auth = require('../auth')
const tags = ['api', 'transfers']

module.exports = [{
  method: 'PUT',
  path: '/transfers/{id}',
  handler: Handler.prepareTransfer,
  config: {
    id: 'transfer',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Prepare a transfer',
    validate: {
      params: {
        id: Joi.string().guid().required().description('Id of transfer to prepare')
      },
      payload: {
        id: Joi.string().uri().required().description('Id of transfer'),
        ledger: Joi.string().uri().required().description('Ledger of transfer'),
        debits: Joi.array().items(Joi.object().keys({
          account: Joi.string().uri().required().description('Debit account of the transfer'),
          amount: Joi.number().required().description('Debit amount of the transfer'),
          memo: Joi.object().optional().unknown().description('Additional information related to the debit'),
          authorized: Joi.boolean().optional().description('Indicates whether debit has been authorized by account holder')
        })).required().description('Debits of the transfer'),
        credits: Joi.array().items(Joi.object().keys({
          account: Joi.string().uri().required().description('Credit account of the transfer'),
          amount: Joi.number().required().description('Credit amount of the transfer'),
          memo: Joi.object().optional().unknown().description('Additional information related to the credit'),
          authorized: Joi.boolean().optional().description('Indicates whether debit has been authorized by account holder')
        })).required().description('Credits of the transfer'),
        execution_condition: Joi.string().trim().max(65535).optional().description('Execution condition of transfer'),
        expires_at: Joi.string().isoDate().optional().description('When the transfer expires')
      }
    }
  }
},
{
  method: 'GET',
  path: '/transfers/{id}',
  handler: Handler.getTransferById,
  config: {
    tags: tags,
    auth: Auth.strategy(),
    description: 'Get transfer by ID',
    validate: {
      params: {
        id: Joi.string().guid().required().description('Id of transfer to retrieve')
      }
    }
  }
},
{
  method: 'PUT',
  path: '/transfers/{id}/fulfillment',
  handler: Handler.fulfillTransfer,
  config: {
    id: 'transfer_fulfillment',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Fulfill a transfer',
    validate: {
      headers: Joi.object({ 'content-type': Joi.string().required().valid('text/plain') }).unknown(),
      params: {
        id: Joi.string().guid().required().description('Id of transfer to fulfill')
      },
      payload: Joi.string().trim().max(65535).required().description('Fulfillment of the execution condition')
    }
  }
},
{
  method: 'PUT',
  path: '/transfers/{id}/rejection',
  handler: Handler.rejectTransfer,
  config: {
    id: 'transfer_rejection',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Reject a transfer',
    validate: {
      params: {
        id: Joi.string().guid().required().description('Id of transfer to reject')
      },
      payload: Joi.object().unknown().optional().description('Rejection reason')
    }
  }
},
{
  method: 'GET',
  path: '/transfers/{id}/fulfillment',
  handler: Handler.getTransferFulfillment,
  config: {
    tags: tags,
    description: 'Get transfer fulfillment',
    auth: Auth.strategy(),
    validate: {
      params: {
        id: Joi.string().guid().required().description('Id of transfer to retrieve fulfillment for')
      }
    }
  }
}
]
