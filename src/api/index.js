'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger
const Config = require('../lib/config')
const Routes = require('./routes')
const Auth = require('./auth')
const Sockets = require('./sockets')
const Worker = require('./worker')
const Account = require('../domain/account')
// const Publish = require('../domain/transfer/kafka/publish')
const Kafka = require('../domain/transfer/kafka/registerKafka')

const Setup = require('../shared/setup')

module.exports = Setup.initialize({ service: 'api', port: Config.PORT, modules: [Auth, Routes, Sockets, Worker, Kafka], loadEventric: false, runMigrations: true })
  .then(server => {
    return Account.createLedgerAccount(Config.LEDGER_ACCOUNT_NAME, Config.LEDGER_ACCOUNT_PASSWORD, Config.LEDGER_ACCOUNT_EMAIL).then(() => server)
  })
  .then(server => server.start().then(() => {
    Logger.info('Server running at: %s', server.info.uri)
  }))
