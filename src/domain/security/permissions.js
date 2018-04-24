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
  ROLE_CREATE: new Permission('ROLE_CREATE', 'Create a new role'),
  ROLE_DELETE: new Permission('ROLE_DELETE', 'Delete role'),
  ROLE_LIST: new Permission('ROLE_LIST', 'List all role'),
  ROLE_UPDATE: new Permission('ROLE_UPDATE', 'Update a role'),
  TOKENS_REJECT_EXPIRED: new Permission('TOKENS_REJECT_EXPIRED', 'Reject expired tokens'),
  TRANSFERS_REJECT_EXPIRED: new Permission('TRANSFSER_REJECT_EXPIRED', 'Reject expired transfers'),
  TRANSFERS_SETTLE: new Permission('TRANSFERS_SETTLE', 'Settle fulfilled transfers'),
  TRANSFERS_LIST: new Permission('TRANSFERS_LIST', 'List all transfers'),
  PARTIES_CREATE: new Permission('PARTIES_CREATE', 'Create new party'),
  PARTIES_DELETE: new Permission('PARTIES_DELETE', 'Delete party'),
  PARTIES_LIST: new Permission('PARTIES_LIST', 'List party'),
  PARTIES_VIEW: new Permission('PARTIES_VIEW', 'View party details'),
  PARTIES_UPDATE: new Permission('PARTIES_UPDATE', 'Update party details'),
  PARTIES_ROLE_LIST: new Permission('PARTIES_ROLE_LIST', 'Get party role'),
  PARTIES_ROLE_UPDATE: new Permission('PARTIES_ROLE_UPDATE', 'Update party role')
}

module.exports = permissions
