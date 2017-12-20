'use strict'

class Permission {
  constructor (key, description) {
    this.key = key
    this.description = description
  }
}

const permissions = {
  ACCOUNTS_CREATE: new Permission('ACCOUNTS_CREATE', 'Create an account'),
  ACCOUNTS_LIST: new Permission('ACCOUNTS_LIST', 'List all accounts'),
  ACCOUNTS_VIEW: new Permission('ACCOUNTS_VIEW', 'View account details'),
  ACCOUNTS_UPDATE: new Permission('ACCOUNTS_UPDATE', 'Update account'),
  POSITIONS_LIST: new Permission('POSITIONS_LIST', 'List positions for all Accounts'),
  POSITIONS_VIEW: new Permission('POSITIONS_VIEW', 'View position for an Account'),
  CHARGES_LIST: new Permission('CHARGES_GET', 'List all charges'),
  CHARGES_CREATE: new Permission('CHARGES_CREATE', 'Create a new charge'),
  CHARGES_UPDATE: new Permission('CHARGES_UPDATE', 'Update a charge'),
  PERMISSIONS_LIST: new Permission('PERMISSIONS_LIST', 'List available permissions'),
  ROLES_CREATE: new Permission('ROLES_CREATE', 'Create a new role'),
  ROLES_DELETE: new Permission('ROLES_DELETE', 'Delete role'),
  ROLES_LIST: new Permission('ROLES_LIST', 'List all roles'),
  ROLES_UPDATE: new Permission('ROLES_UPDATE', 'Update a role'),
  TOKENS_REJECT_EXPIRED: new Permission('TOKENS_REJECT_EXPIRED', 'Reject expired tokens'),
  TRANSFERS_REJECT_EXPIRED: new Permission('TRANSFSER_REJECT_EXPIRED', 'Reject expired transfers'),
  TRANSFERS_SETTLE: new Permission('TRANSFERS_SETTLE', 'Settle fulfilled transfers'),
  TRANSFERS_LIST: new Permission('TRANSFERS_LIST', 'List all transfers'),
  USERS_CREATE: new Permission('USERS_CREATE', 'Create new user'),
  USERS_DELETE: new Permission('USERS_DELETE', 'Delete user'),
  USERS_LIST: new Permission('USERS_LIST', 'List users'),
  USERS_VIEW: new Permission('USERS_VIEW', 'View users details'),
  USERS_UPDATE: new Permission('USERS_UPDATE', 'Update user details'),
  USERS_ROLES_LIST: new Permission('USERS_ROLES_LIST', 'Get users roles'),
  USERS_ROLES_UPDATE: new Permission('USERS_ROLES_UPDATE', 'Update users roles')
}

module.exports = permissions
