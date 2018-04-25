'use strict'

class Permission {
  constructor (key, description) {
    this.key = key
    this.description = description
  }
}

const permissions = {
  PARTICIPANTS_CREATE: new Permission('PARTICIPANTS_CREATE', 'Create an participant'),
  PARTICIPANTS_LIST: new Permission('PARTICIPANTS_LIST', 'List all participant'),
  PARTICIPANTS_VIEW: new Permission('PARTICIPANTS_VIEW', 'View participant details'),
  PARTICIPANTS_UPDATE: new Permission('PARTICIPANTS_UPDATE', 'Update participant'),
  POSITIONS_LIST: new Permission('POSITIONS_LIST', 'List positions for all Participants'),
  POSITIONS_VIEW: new Permission('POSITIONS_VIEW', 'View position for an Participant'),
  CHARGE_LIST: new Permission('CHARGE_GET', 'List all charges'),
  CHARGE_CREATE: new Permission('CHARGE_CREATE', 'Create a new charge'),
  CHARGE_UPDATE: new Permission('CHARGE_UPDATE', 'Update a charge'),
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
  PARTIES_ROLE_UPDATE: new Permission('PARTIES_ROLE_UPDATE', 'Update party role'),
  CURRENCY_LIST: new Permission('CURRENCY_LIST', 'List all currencies'),
  CURRENCY_CREATE: new Permission('CURRENCY_CREATE', 'Create new currency'),
  CURRENCY_UPDATE: new Permission('CURRENCY_UPDATE', 'Update currency')
}

module.exports = permissions
