'use strict'

const Util = require('../../lib/util')
const JWT = require('../../domain/security/jwt')

const reducePermissions = (roles) => {
  const flattened = []
  roles.map(x => x.permissions).forEach(p => {
    p.forEach(permission => {
      if (!flattened.includes(permission)) {
        flattened.push(permission)
      }
    })
  })
  return flattened
}

const validate = (request, token, cb) => {
  JWT.verify(token)
    .then(({ user, roles }) => {
      const scope = reducePermissions(roles)
      const credentials = Util.merge(user, { scope: scope })
      return cb(null, true, credentials)
    })
    .catch(e => cb(e, false))
}

module.exports = {
  name: 'admin-token',
  scheme: 'bearer',
  validate: validate
}

