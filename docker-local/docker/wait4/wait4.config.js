module.exports = {
  // format version sem-ver
  // `v{major}.${minor}.${patch}`
  wait4: 'v0.1.0',

  // How many times should we retry waiting for a service?
  retries: 60,

  // How many ms to wait before retrying a service connection?
  // waitMs: 2500,
  waitMs: 10000,

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
          },
          retries: 60
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
          retries: 60
        },
        {
          description: 'MySQL ALS',
          uri: 'mysql-als:3306',
          method: 'mysql',
          // customized RC setup
          rc: {
            namespace: 'ALS',
            configPath: '../config/default.json'
          },
          retries: 60
        }
      ]
    },
    {
      name: 'ml-api-adapter',
      wait4: [
        {
          uri: 'kafka:29092',
          method: 'ncat',
          // Seems to take longer on circleci to start up
          retries: 60
        }
      ]
    },
    {
      name: 'thirdparty-api-svc',
      wait4: [
        {
          uri: 'kafka:29092',
          method: 'ncat'
        }
      ]
    },
    {
      name: 'pisp-thirdparty-sdk',
      wait4: [
        {
          description: 'PISP Redis Cache',
          uri: 'pisp-redis:6379',
          method: 'ncat'
        }
      ]
    },
    {
      name: 'dfspa-thirdparty-sdk',
      wait4: [
        {
          description: 'DFSP A Redis Cache',
          uri: 'dfspa-redis:6379',
          method: 'ncat'
        }
      ]
    },
    {
      name: 'dfspb-thirdparty-sdk',
      wait4: [
        {
          description: 'DFSP B Redis Cache',
          uri: 'dfspb-redis:6379',
          method: 'ncat'
        }
      ]
    },
    {
      name: 'als-consent-oracle',
      wait4: [
        {
          description: 'MySQL Database',
          uri: 'als-consent-oracle-mysql:3306',
          method: 'mysql',
          rc: {
            namespace: 'CO',
            configPath: '../config/default.json'
          },
          retries: 60
        }
      ]
    },
    {
      name: 'auth-service',
      wait4: [
        {
          description: 'MySQL Database',
          uri: 'auth-service-mysql:3306',
          method: 'mysqlAlt',
          rc: {
            namespace: '',
            configPath: '../dist/config/integration.json'
          },
          retries: 30
        }
      ]
    }
  ]
}
