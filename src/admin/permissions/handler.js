'use strict'

const Permissions = require('../../domain/security/permissions')

const getPermissions = (request, reply) => {
  const permissions = Object.keys(Permissions).map(k => {
    /* istanbul ignore else */
    if (Permissions.hasOwnProperty(k)) {
      return Permissions[k]
    }
  })
  reply(permissions)
}

module.exports = {
  getPermissions
}
