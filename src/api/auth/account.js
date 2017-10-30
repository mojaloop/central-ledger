'use strict'

const Config = require('../../lib/config')
const AccountService = require('../../domain/account')
const Logger = require('@mojaloop/central-services-shared').Logger

const validate = (request, name, password, cb) => {
  if (!password) {
    return cb(null, false)
  }
  if (Config.ADMIN_KEY && Config.ADMIN_SECRET && name === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return cb(null, true, { name: Config.ADMIN_KEY, is_admin: true })
  }
  return AccountService.verify(name, password)
    .then(account => cb(null, true, account))
    .catch(e => {
      Logger.error(e)
      return cb(null, false)
    })
}

module.exports = {
  name: 'account',
  scheme: 'basic',
  validate
}
