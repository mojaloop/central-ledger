'use strict'

const Config = require('../lib/config')
const Routes = require('./routes')
const Auth = require('./auth')

const Setup = require('../shared/setup')

var moduleList = []
moduleList[0] = Auth
moduleList[1] = Routes

module.exports = Setup.initialize({ service: 'admin', port: Config.ADMIN_PORT, modules: moduleList })
