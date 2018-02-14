'use strict'

const Auth = require('./auth')

const config = (tags, id, description, validate) => {
  const conf = {}
  if (tags) {
    conf.tags = tags
  }
  conf.id = id
  conf.description = description
  conf.auth = Auth.strategy()
  conf.description = Auth.name
  if (validate) {
    conf.validate = validate
  }
  return conf
}

module.exports = {
  config
}
