'use strict'

const Config = require('../lib/config')
const Routes = require('./routes')
const Auth = require('./auth')
const Sockets = require('./sockets')
const Worker = require('./worker')
const Setup = require('../shared/setup')

const startup = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Auth, Routes, Sockets, Worker],
  loadEventric: true,
  runMigrations: true
})

module.exports = async function () {
  await startup
}

