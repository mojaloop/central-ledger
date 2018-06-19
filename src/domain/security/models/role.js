'use strict'

const Uuid = require('uuid4')
const Db = require('../../../db')

const remove = (roleId) => Db.role.destroy({ roleId })

const save = (role) => {
  if (!role.roleId) {
    role.roleId = Uuid()
    return Db.role.insert(role)
  } else {
    return Db.role.update({ roleId: role.roleId }, role)
  }
}

const getAll = () => Db.role.find({})

const getById = (roleId) => Db.role.findOne({ roleId })

const addPartyRole = (userRole) => Db.partyRole.insert(userRole)

const getPartyRole = (partyId) => {
  return Db.role.query(builder => {
    return builder
      .innerJoin('partyRole as ur', 'role.roleId', 'ur.roleId')
      .where('ur.partyId', partyId)
      .select('role.*')
  })
}

const removePartyRole = (partyId) => Db.partyRole.destroy({ partyId })

module.exports = {
  addPartyRole,
  getAll,
  getById,
  getPartyRole,
  remove,
  removePartyRole,
  save
}
