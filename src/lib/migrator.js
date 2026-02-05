'use strict'

const Path = require('path')
const Migrations = require('@mojaloop/database-lib').Migrations
const Knexfile = require('../knexfile')

exports.migrate = function () {
  return Migrations.migrate(updateMigrationsLocation(Knexfile))
}

const updateMigrationsLocation = (kf) => {
  const parsedMigrationDir = Path.parse(kf.migrations.directory)
  kf.migrations.directory = Path.join(__dirname, '..', parsedMigrationDir.base)
  const parsedSeedsDir = Path.parse(kf.seeds.directory)
  kf.seeds.directory = Path.join(__dirname, '..', parsedSeedsDir.base)
  return kf
}
