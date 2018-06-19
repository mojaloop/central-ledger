'use strict'

const Util = require('../../lib/util')
const JWT = require('../../domain/security/jwt')
const Errors = require('../../errors')

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
  try {
    let isValid = false
    const result = await JWT.verify(token)
    if (result) {
      isValid = true
      const scope = reducePermissions(result.roles)
      const credentials = Util.merge(result.user, {scope: scope})
      return {isValid, credentials}
    } else {
      throw new Errors.UnauthorizedError('Invalid token')
    }
  } catch (e) {
    return {e, verified: false}
  }
}

module.exports = {
  name: 'admin-token',
  scheme: 'jwt-strategy',
  validate: validate
}

