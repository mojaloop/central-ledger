'use strict'

const Permissions = require('../../domain/security/permissions')

const getPermissions = function (request, h) {
  const permissions = Object.keys(Permissions).map(k => {
    /* istanbul ignore else */
    if (Permissions.hasOwnProperty(k)) {
      return Permissions[k]
    }
  })
  return permissions
}

module.exports = {
  getPermissions
}
