'use strict'

class Permission {
  constructor (key, description) {
    this.key = key
    this.description = description
  }
}

// TODO: currently not used anywhere
const permissions = {
  PARTICIPANTS_CREATE: new Permission('PARTICIPANTS_CREATE', 'Create a participant'),
  PARTICIPANTS_LIST: new Permission('PARTICIPANTS_LIST', 'List all participants'),
  PARTICIPANTS_VIEW: new Permission('PARTICIPANTS_VIEW', 'View participant details'),
  PARTICIPANTS_UPDATE: new Permission('PARTICIPANTS_UPDATE', 'Update participant'),
  POSITIONS_LIST: new Permission('POSITIONS_LIST', 'List positions for all Participants'),
  POSITIONS_VIEW: new Permission('POSITIONS_VIEW', 'View position for an Participant'),
  PERMISSIONS_LIST: new Permission('PERMISSIONS_LIST', 'List available permissions'),
  TOKENS_REJECT_EXPIRED: new Permission('TOKENS_REJECT_EXPIRED', 'Reject expired tokens'),
  TRANSFERS_REJECT_EXPIRED: new Permission('TRANSFSER_REJECT_EXPIRED', 'Reject expired transfers'),
  TRANSFERS_SETTLE: new Permission('TRANSFERS_SETTLE', 'Settle fulfiled transfers'),
  TRANSFERS_LIST: new Permission('TRANSFERS_LIST', 'List all transfers'),
  CURRENCY_LIST: new Permission('CURRENCY_LIST', 'List all currencies'),
  CURRENCY_CREATE: new Permission('CURRENCY_CREATE', 'Create new currency'),
  CURRENCY_UPDATE: new Permission('CURRENCY_UPDATE', 'Update currency')
}

module.exports = permissions
