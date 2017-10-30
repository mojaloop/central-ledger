'use strict'

const Auth = require('./auth')

const config = (tags, permission, validate) => {
  const conf = {}
  if (tags) {
    conf.tags = tags
  }

  if (permission) {
    if (permission.key) {
      conf.auth = Auth.tokenAuth(permission)
      conf.description = permission.description
    } else {
      conf.description = permission
    }
  }

  if (validate) {
    conf.validate = validate
  }

  return conf
}

module.exports = {
  config
}
