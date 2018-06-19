const Handler = require('./handler')
const tags = ['api', 'metadata']

module.exports = [
  {
    method: 'GET',
    path: '/health',
    handler: Handler.health,
    options: {
      tags: tags,
      description: 'Status of ledger',
      id: 'health'
    }
  },
  {
    method: 'GET',
    path: '/',
    handler: Handler.metadata,
    options: {
      tags: tags,
      description: 'Metadata'
    }
  }
]
