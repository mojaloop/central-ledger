'use strict'

const SecurityService = require('../../domain/security')
const Sidecar = require('../../lib/sidecar')

const create = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.createParty(request.payload)
}

const getAll = async function (request, h) {
  return await SecurityService.getAllParty()
}

const getById = async function (request, h) {
  return await SecurityService.getPartyById(request.params.id)
}

const remove = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.deleteParty(request.params.id)
}

const update = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.updateParty(request.params.id, request.payload)
}

const getRoles = async function (request, h) {
  return await SecurityService.getPartyRoles(request.params.id)
}

const updateRoles = async function (request, h) {
  Sidecar.logRequest(request)
  return await SecurityService.updatePartyRoles(request.params.id, request.payload)
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
