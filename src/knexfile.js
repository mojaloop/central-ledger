'use strict'

const Config = require('./lib/config')

module.exports = {
  client: 'mysql',
  version: '5.5',
  connection: Config.DATABASE.connection,
  pool: Config.DATABASE.pool,
  migrations: {
    directory: './migrations',
    tableName: 'migration',
    stub: './migrations/migration.template'
  },
  seeds: {
    directory: './seeds',
    loadExtensions: ['.js']
  }
}
