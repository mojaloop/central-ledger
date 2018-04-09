const Handler = require('./handler')
const Auth = require('../auth')
const tags = ['api', 'positions']

module.exports = [{
  method: 'GET',
  path: '/positions',
  handler: Handler.calculateForAllAccounts,
  options: {
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
  options: {
    id: 'positions_account',
    tags: tags,
    auth: Auth.strategy(),
    description: 'Retrieve outstanding positions for an account.'
  }
}
]
