'use strict'

// const Bcrypt = require('bcrypt') for later use
const Config = require('../../lib/config')
const Logger = require('@mojaloop/central-services-shared').Logger

const validate = async (request, username, password, h) => {
  if (!(username && password && Config.ADMIN_KEY && Config.ADMIN_SECRET)) {
    return {credentials: null, isValid: false}
  }
  const isValid = password === Config.ADMIN_SECRET
  // const isValid = await Bcrypt.compare(password, Config.ADMIN_SECRET) to be used in the future to hash passwords
  if (username === Config.ADMIN_KEY && isValid) {
    const credentials = {id: 'test', name: username, is_admin: true}
    Logger.info('is a valid admin')
    return {isValid: true, credentials}
  } else {
    return {credentials: null, isValid: false}
  }
}

module.exports = {
  name: 'admin',
  scheme: 'simple',
  validate
}
