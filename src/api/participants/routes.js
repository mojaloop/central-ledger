const Handler = require('./handler')
const Joi = require('joi')
const Auth = require('../auth')
// const Boom = require('boom')

const tags = ['api', 'participants']
const nameValidator = Joi.string().alphanum().min(3).max(30).required().description('Name of the participant')
const passwordValidator = Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the participant')
// const emailAddressValidator = Joi.string().email()

module.exports = [{
  method: 'POST',
  path: '/participants',
  handler: Handler.create,
  options: {
    id: 'participants',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Create an participant.',
    payload: {
      allow: 'application/json',
      failAction: 'error',
      output: 'data'
    },
    validate: {
      payload: {
        name: Joi.string().alphanum().min(3).max(30).required().description('Name of the participant'),
        password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/).required().description('Password for the participant'),
        emailAddress: Joi.string().email().required()
      }
    }
  }
},
{
  method: 'GET',
  path: '/participants/{name}',
  handler: Handler.getByName,
  options: {
    id: 'participant',
    tags: tags,
    description: 'Retrieve an participants details by name',
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
  path: '/participants/{name}',
  handler: Handler.updatePartyCredentials,
  options: {
    id: 'participant_update_user_credentials',
    tags: tags,
    description: 'Update an participants party credentials',
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
  path: '/participants/{name}/settlement',
  handler: Handler.updateParticipantSettlement,
  options: {
    id: 'participant_update_participant_settlement',
    tags: tags,
    description: 'Update an participants party credentials',
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
        participant_number: Joi.string().token().max(16).required().description('Participant number for the settlement'),
        routing_number: Joi.string().token().max(16).required().description('Routing number for the settlement')
      }
    }
  }
}
]
