'use strict'

const SecurityService = require('../../domain/security')
const Sidecar = require('../../lib/sidecar')

const getRole = function (request, h) {
  return SecurityService.getAllRole()
}

const createRole = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.createRole(request.payload)
}

const updateRole = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.updateRole(request.params.id, request.payload)
}

const deleteRole = async function (request, h) {
  Sidecar.logRequest(request)
  await SecurityService.deleteRole(request.params.id)
  return h.response().code(204)
}

module.exports = {
  createRole,
  deleteRole,
  getRole,
  updateRole
}
