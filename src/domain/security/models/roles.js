'use strict'

const Uuid = require('uuid4')
const Db = require('../../../db')

const remove = (roleId) => Db.roles.destroy({ roleId })

const save = (role) => {
  if (!role.roleId) {
    role.roleId = Uuid()
    return Db.roles.insert(role)
  } else {
    return Db.roles.update({ roleId: role.roleId }, role)
  }
}

const getAll = () => Db.roles.find({})

const getById = (roleId) => Db.roles.findOne({ roleId })

const addPartyRole = (userRole) => Db.partyRole.insert(userRole)

const getPartyRoles = (partyId) => {
  return Db.roles.query(builder => {
    return builder
      .innerJoin('partyRole as ur', 'roles.roleId', 'ur.roleId')
      .where('ur.partyId', partyId)
      .select('roles.*')
  })
}

const removePartyRoles = (partyId) => Db.partyRole.destroy({ partyId })

module.exports = {
  addPartyRole,
  getAll,
  getById,
  getPartyRoles,
  remove,
  removePartyRoles,
  save
}
