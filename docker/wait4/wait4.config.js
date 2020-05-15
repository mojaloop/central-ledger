module.exports = {
  // format version sem-ver
  // `v{major}.${minor}.${patch}`
  wait4: 'v0.1.0',

  // How many times should we retry waiting for a service?
  retries: 10,

  // How many ms to wait before retrying a service connection?
  waitMs: 2500,

  // services definitions
  services: [
    {
      name: 'central-ledger',

      // list of services to wait for
      wait4: [
        {
          description: 'Kafka broker',
          uri: 'kafka:29092',
          method: 'ncat'
        },
        {
          description: 'MySQL ledger',
          uri: 'mysql:3306',
          method: 'mysql',
          // customized RC setup
          rc: {
            namespace: 'CLEDG',
            configPath: '../config/default.json'
          }
        },
        {
          description: 'MongoDB object store',
          uri: 'mongodb://objstore:27017/mlos',
          method: 'mongo'
        }
      ]
    },
    {
      name: 'central-settlement',
      wait4: [
        {
          uri: 'kafka:29092',
          method: 'ncat'
        },
        {
          uri: 'mysql:3306',
          method: 'mysql'
        }
      ]
    },
    {
      name: 'account-lookup-service',
      wait4: [
        {
          description: 'central-ledger api server',
          uri: 'central-ledger:3001',
          method: 'ncat',

          // we have to wait much longer for central-ledger
          // to spin up so we overload `retires` default parameter value
          retries: 30
        },
        {
          description: 'MySQL ALS',
          uri: 'mysql-als:3306',

          // example of using ncat instead knex,
          // so we don\'t have to know db connection parameters
          method: 'ncat'
        }
      ]
    },
    {
      name: 'ml-api-adapter',
      wait4: [
        {
          uri: 'kafka:29092',
          method: 'ncat'
        }
      ]
    }
  ]
}
