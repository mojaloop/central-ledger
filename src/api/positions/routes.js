const Handler = require('./handler')
const Auth = require('../auth')
const tags = ['api', 'positions']

module.exports = [{
  method: 'GET',
  path: '/positions',
  handler: Handler.calculateForAllAccounts,
  config: {
    id: 'positions',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Retrieve outstanding positions.'
  }
},
{
  method: 'GET',
  path: '/positions/{name}',
  handler: Handler.calculateForAccount,
  config: {
    id: 'positions_account',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Retrieve outstanding positions for an account.'
  }
}
]
