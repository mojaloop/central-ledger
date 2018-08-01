'use strict'

const Config = require('../lib/config')
const Routes = require('./routes')
const Auth = require('./auth')
const Sockets = require('./sockets')
const Worker = require('./worker')
const Setup = require('../shared/setup')

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Auth, Routes, Sockets, Worker],
  runMigrations: true,
  runHandlers: !Config.HANDLERS_DISABLED
})
