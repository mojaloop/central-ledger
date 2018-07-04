'use strict'

const Config = require('../../lib/config')
const AccountService = require('../../domain/account')

/*
const validates = (request, name, password, cb) => {
  if (!password) {
    return cb(null, false)
  }
  if (Config.ADMIN_KEY && Config.ADMIN_SECRET && name === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return cb(null, true, {name: Config.ADMIN_KEY, is_admin: true})
  }
  return AccountService.verify(name, password)
    .then(account => cb(null, true, account))
    .catch(e => {
      Logger.error(e)
      return cb(null, false)
    })
}
*/

const validate = async (request, name, password, h) => {
  if (!password) {
    return {credentials: null, isValid: false}
  }
  if (Config.ADMIN_KEY && Config.ADMIN_SECRET && name === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return {credentials: {is_admin: true, name}, isValid: true}
  }
  const account = await AccountService.verify(name, password)
  if (account) {
    return {credentials: account, isValid: true}
  } else {
    return {credentials: null, isValid: false}
  }
}

module.exports = {
  name: 'account',
  scheme: 'simple',
  validate
}
