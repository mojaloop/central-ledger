'use strict'

const Errors = require('../../errors')
const Util = require('../../lib/util')
const RoleModel = require('./models/role')
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

const getAllRole = () => RoleModel.getAll().map(expandRole)

const getAllParty = () => PartyModel.getAll()

const getPartyById = (partyId) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
}

const getPartyByKey = (key) => {
  return PartyModel.getByKey(key)
    .then(ensurePartyExists)
}

const getPartyRole = (partyId) => RoleModel.getPartyRole(partyId).map(expandRole)

const createRole = (role) => {
  return RoleModel.save(compactRole(role))
    .then(expandRole)
}

const createParty = (party) => {
  return PartyModel.save(party)
}

const deleteRole = (roleId) => {
  return RoleModel.remove(roleId)
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
    .then(() => RoleModel.removePartyRole(partyId))
    .then(() => PartyModel.remove(partyId))
}

const updateRole = (roleId, newRole) => {
  return RoleModel.getById(roleId)
    .then(existing => {
      if (!existing) {
        throw new Errors.NotFoundError('Role does not exist')
      }
      return RoleModel.save(compactRole(Util.merge(existing, newRole)))
        .then(expandRole)
    })
}

const updateParty = (partyId, details) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
    .then(party => PartyModel.save(Util.merge(party, details)))
}

const updatePartyRole = (partyId, role) => {
  return PartyModel.getById(partyId)
    .then(ensurePartyExists)
    .then(party => RoleModel.removePartyRole(partyId))
    .then(() => role.forEach(roleId => RoleModel.addPartyRole({ partyId, roleId: roleId })))
    .then(() => getPartyRole(partyId))
}

module.exports = {
  createRole,
  createParty,
  deleteRole,
  deleteParty,
  getAllRole,
  getPartyById,
  getPartyByKey,
  getAllParty,
  getPartyRole,
  updateRole,
  updateParty,
  updatePartyRole
}
