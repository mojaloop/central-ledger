const Handler = require('./handler')
const Auth = require('../auth')
const tags = ['api', 'positions']

module.exports = [{
  method: 'GET',
  path: '/positions',
  handler: Handler.calculateForAllAccounts,
  config: {
    id: 'positions',
    auth: Auth.strategy(),
    tags: tags,
    description: 'Retrieve outstanding positions.'
  }
},
{
  method: 'GET',
  path: '/positions/{name}',
  handler: Handler.calculateForAccount,
  config: {
    id: 'positions_account',
    auth: Auth.strategy(),
    tags: tags,
    description: 'Retrieve outstanding positions for an account.'
  }
}
]
