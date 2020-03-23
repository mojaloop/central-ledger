'use strict'

process.env.UV_THREADPOOL_SIZE = 12

const Config = require('../lib/config')
const Routes = require('./routes')
const Setup = require('../shared/setup')

process.env.UV_THREADPOOL_SIZE = 12

module.exports = Setup.initialize({
  service: 'api',
  port: Config.PORT,
  modules: [Routes],
  runMigrations: Config.RUN_MIGRATIONS,
  runHandlers: !Config.HANDLERS_DISABLED,
  handlers: [{ enabled: true, type: 'preparePosition' }, { enabled: true, type: 'fulfilPosition' }, { enabled: true, type: 'admin' }, { enabled: true, type: 'get' }]
})
