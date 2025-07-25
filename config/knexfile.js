'use strict'

const migrationsDirectory = '../migrations'
const seedsDirectory = '../seeds'

const Config = require('../src/lib/config')

module.exports = {
  ...Config.DATABASE,
  migrations: {
    directory: migrationsDirectory,
    tableName: 'migration',
    stub: `${migrationsDirectory}/migration.template`
  },
  seeds: {
    directory: seedsDirectory,
    loadExtensions: ['.js']
  }
}
