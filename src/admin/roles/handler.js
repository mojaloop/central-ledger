'use strict'

const SecurityService = require('../../domain/security')
const Sidecar = require('../../lib/sidecar')

const getRoles = (request, reply) => {
  SecurityService.getAllRoles()
    .then(reply)
    .catch(reply)
}

const createRole = (request, reply) => {
  Sidecar.logRequest(request)
  SecurityService.createRole(request.payload)
    .then(reply)
    .catch(reply)
}

const updateRole = (request, reply) => {
  Sidecar.logRequest(request)
  SecurityService.updateRole(request.params.id, request.payload)
    .then(reply)
    .catch(reply)
}

const deleteRole = (request, reply) => {
  Sidecar.logRequest(request)
  SecurityService.deleteRole(request.params.id)
    .then(() => reply().code(204))
    .catch(reply)
}

module.exports = {
  createRole,
  deleteRole,
  getRoles,
  updateRole
}
