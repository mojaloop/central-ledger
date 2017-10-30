'use strict'

const Config = require('../../lib/config')

const validate = (request, username, password, cb) => {
  if (!(username && password && Config.ADMIN_KEY && Config.ADMIN_SECRET)) {
    return cb(null, false)
  }

  if (username === Config.ADMIN_KEY && password === Config.ADMIN_SECRET) {
    return cb(null, true, { is_admin: true })
  } else {
    return cb(null, false)
  }
}

module.exports = {
  name: 'admin',
  scheme: 'basic',
  validate
}
