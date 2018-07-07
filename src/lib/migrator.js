'use strict'

const Path = require('path')
const Migrations = require('@mojaloop/central-services-database').Migrations
const Knexfile = require('../../config/knexfile')

exports.migrate = function () {
  return Migrations.migrate(updateMigrationsLocation(Knexfile))
}

const updateMigrationsLocation = (kf) => {
  const parsedMigrationDir = Path.parse(kf.migrations.directory)
  kf.migrations.directory = Path.join(process.cwd(), parsedMigrationDir.base)
  const parsedSeedsDir = Path.parse(kf.seeds.directory)
  kf.seeds.directory = Path.join(process.cwd(), parsedSeedsDir.base)
  return kf
}
