'use strict'

const SecurityService = require('../../domain/security')
const Sidecar = require('../../lib/sidecar')

const create = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.createUser(request.payload)
}

const getAll = function (request, h) {
  return SecurityService.getAllUsers()
}

const getById = function (request, h) {
  return SecurityService.getUserById(request.params.id)
}

const remove = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.deleteUser(request.params.id)
}

const update = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.updateUser(request.params.id, request.payload)
}

const getRoles = function (request, h) {
  return SecurityService.getUserRoles(request.params.id)
}

const updateRoles = function (request, h) {
  Sidecar.logRequest(request)
  return SecurityService.updateUserRoles(request.params.id, request.payload)
}

module.exports = {
  create,
  remove,
  getAll,
  getById,
  getRoles,
  update,
  updateRoles
}
