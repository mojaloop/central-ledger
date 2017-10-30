'use strict'

const Errors = require('../../errors')
const Util = require('../../lib/util')
const RolesModel = require('./models/roles')
const UsersModel = require('./models/users')

const ensureUserExists = (user) => {
  if (!user) {
    throw new Errors.NotFoundError('User does not exist')
  }
  return user
}

const expandRole = (role) => {
  return Util.mergeAndOmitNil(role, { permissions: Util.expand(role.permissions), createdDate: null })
}

const compactRole = (role) => {
  return Util.mergeAndOmitNil(role, { permissions: Util.squish(role.permissions) })
}

const getAllRoles = () => RolesModel.getAll().map(expandRole)

const getAllUsers = () => UsersModel.getAll()

const getUserById = (userId) => {
  return UsersModel.getById(userId)
    .then(ensureUserExists)
}

const getUserByKey = (key) => {
  return UsersModel.getByKey(key)
    .then(ensureUserExists)
}

const getUserRoles = (userId) => RolesModel.getUserRoles(userId).map(expandRole)

const createRole = (role) => {
  return RolesModel.save(compactRole(role))
    .then(expandRole)
}

const createUser = (user) => {
  return UsersModel.save(user)
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

const deleteUser = (userId) => {
  return UsersModel.getById(userId)
    .then(ensureUserExists)
    .then(() => RolesModel.removeUserRoles(userId))
    .then(() => UsersModel.remove(userId))
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

const updateUser = (userId, details) => {
  return UsersModel.getById(userId)
    .then(ensureUserExists)
    .then(user => UsersModel.save(Util.merge(user, details)))
}

const updateUserRoles = (userId, roles) => {
  return UsersModel.getById(userId)
    .then(ensureUserExists)
    .then(user => RolesModel.removeUserRoles(userId))
    .then(() => roles.forEach(roleId => RolesModel.addUserRole({ userId, roleId: roleId })))
    .then(() => getUserRoles(userId))
}

module.exports = {
  createRole,
  createUser,
  deleteRole,
  deleteUser,
  getAllRoles,
  getUserById,
  getUserByKey,
  getAllUsers,
  getUserRoles,
  updateRole,
  updateUser,
  updateUserRoles
}
