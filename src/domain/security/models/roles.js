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

const addUserRole = (userRole) => Db.userRoles.insert(userRole)

const getUserRoles = (userId) => {
  return Db.roles.query(builder => {
    return builder
      .innerJoin('userRoles as ur', 'roles.roleId', 'ur.roleId')
      .where('ur.userId', userId)
      .select('roles.*')
  })
}

const removeUserRoles = (userId) => Db.userRoles.destroy({ userId })

module.exports = {
  addUserRole,
  getAll,
  getById,
  getUserRoles,
  remove,
  removeUserRoles,
  save
}
