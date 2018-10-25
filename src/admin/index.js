'use strict'

const Config = require('../lib/config')
const Routes = require('./routes')
// const HandlerRoutes = require('../handlers/plugin')

const Setup = require('../shared/setup')

var moduleList = []
moduleList[0] = Routes
// moduleList[2] = HandlerRoutes

module.exports = Setup.initialize({ service: 'admin', port: Config.ADMIN_PORT, modules: moduleList })
