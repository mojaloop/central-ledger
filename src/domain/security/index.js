'use strict'

const Errors = require('../../errors')
const Util = require('../../lib/util')
const RolesModel = require('./models/roles')
const PartyModel = require('./models/party')

const ensurePartyExists = (party) => {
  if (!party) {
    throw new Errors.NotFoundError('Party does not exist')
  }
  return party
}

const expandRole = (role) => {
  return Util.mergeAndOmitNil(role, { permissions: Util.expand(role.permissions), createdDate: null })
}

const compactRole = (role) => {
  return Util.mergeAndOmitNil(role, { permissions: Util.squish(role.permissions) })
}

const getAllRoles = () => RolesModel.getAll().map(expandRole)

const getAllParty = () => PartyModel.getAll()

const getPartyById = (partyId) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
}

const getPartyByKey = (key) => {
  return PartyModel.getByKey(key)
    .then(ensurePartyExists)
}

const getPartyRoles = (partyId) => RolesModel.getPartyRoles(partyId).map(expandRole)

const createRole = (role) => {
  return RolesModel.save(compactRole(role))
    .then(expandRole)
}

const createParty = (party) => {
  return PartyModel.save(party)
}

const deleteRole = (roleId) => {
  return RolesModel.remove(roleId)
    .then(results => {
      if (!results || results.length === 0) {
        throw new Errors.NotFoundError('Role does not exist')
      }
      return results
    })
}

const deleteParty = (partyId) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
    .then(() => RolesModel.removePartyRoles(partyId))
    .then(() => PartyModel.remove(partyId))
}

const updateRole = (roleId, newRole) => {
  return RolesModel.getById(roleId)
    .then(existing => {
      if (!existing) {
        throw new Errors.NotFoundError('Role does not exist')
      }
      return RolesModel.save(compactRole(Util.merge(existing, newRole)))
        .then(expandRole)
    })
}

const updateParty = (partyId, details) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
    .then(party => PartyModel.save(Util.merge(party, details)))
}

const updatePartyRoles = (partyId, roles) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
    .then(party => RolesModel.removePartyRoles(partyId))
    .then(() => roles.forEach(roleId => RolesModel.addPartyRole({ partyId, roleId: roleId })))
    .then(() => getPartyRoles(partyId))
}

module.exports = {
  createRole,
  createParty,
  deleteRole,
  deleteParty,
  getAllRoles,
  getPartyById,
  getPartyByKey,
  getAllParty,
  getPartyRoles,
  updateRole,
  updateParty,
  updatePartyRoles
}
