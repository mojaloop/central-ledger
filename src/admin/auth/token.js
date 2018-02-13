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

const validate = async (request, token, h) => {
  let isValid = false
  JWT.verify(token)
    .then(({ user, roles }) => {
      isValid = true
      const scope = reducePermissions(roles)
      const credentials = Util.merge(user, { scope: scope })
      return {isValid, credentials}
    })
    .catch(e => h(e, false))
}

module.exports = {
  name: 'admin-token',
  scheme: 'jwt-strategy',
  validate: validate
}

