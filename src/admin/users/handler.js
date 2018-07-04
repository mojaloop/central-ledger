'use strict'

const SecurityService = require('../../domain/security')
const Sidecar = require('../../lib/sidecar')

const create = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.createUser(request.payload)
}

const getAll = async function (request, h) {
  return await SecurityService.getAllUsers()
}

const getById = async function (request, h) {
  return await SecurityService.getUserById(request.params.id)
}

const remove = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.deleteUser(request.params.id)
}

const update = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.updateUser(request.params.id, request.payload)
}

const getRoles = async function (request, h) {
  return await SecurityService.getUserRoles(request.params.id)
}

const updateRoles = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.updateUserRoles(request.params.id, request.payload)
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
