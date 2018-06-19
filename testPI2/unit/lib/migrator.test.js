'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Path = require('path')
const Migrations = require('@mojaloop/central-services-database').Migrations
const Proxyquire = require('proxyquire')

Test('migrator', migratorTest => {
  let sandbox
  let configuredMigrationsFolder
  let Migrator

  migratorTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Migrations)

    configuredMigrationsFolder = 'migrations-path'

    Migrator = Proxyquire('../../../src/lib/migrator', { '../../config/knexfile': { migrations: { directory: `../${configuredMigrationsFolder}` } } })

    t.end()
  })

  migratorTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  migratorTest.test('migrate should', migrateTest => {
    migrateTest.test('override migrations directory path and run migrations', test => {
      Migrations.migrate.returns(P.resolve())

      let updatedMigrationsPath = Path.join(process.cwd(), configuredMigrationsFolder)

      Migrator.migrate()
        .then(() => {
          test.ok(Migrations.migrate.calledOnce)
          test.ok(Migrations.migrate.firstCall.args[0].migrations.directory, updatedMigrationsPath)
          test.end()
        })
    })

    migrateTest.end()
  })

  migratorTest.end()
})
