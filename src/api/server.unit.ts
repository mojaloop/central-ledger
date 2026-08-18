import { it, describe } from 'node:test'
import server from './server'

describe('server ', () => {
  it('.run() fails to initialize the server without database',
    { expectFailure: 'Error while initializing' },
    async () => {
      await server.run()
    })

  it('.migrate() fails to migrate without the database',
    { expectFailure: 'Error while initializing' },
    async () => {
      await server.migrate()
    })
})