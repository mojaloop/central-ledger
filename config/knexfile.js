'use strict'

const migrationsDirectory = '../migrations'
const Config = require('../src/lib/config')
module.exports = {
  client: 'mysql',
  connection: Config.DATABASE_URI,
  migrations: {
    directory: migrationsDirectory,
    tableName: 'migrations',
    stub: `${migrationsDirectory}/migration.template`
  }
}
