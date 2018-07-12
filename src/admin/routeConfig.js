'use strict'

const Auth = require('./auth')

const config = (tags, permission, validate) => {
  const conf = {}
  if (tags) {
    conf.tags = tags
  }
  if (validate) {
    if (validate.payload) {
      conf.payload = validate.payload
    }
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
    if (validate.validate) {
      conf.validate = validate.validate
    }
  }
  return conf
}

module.exports = {
  config
}
