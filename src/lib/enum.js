'use strict'

module.exports = {
  // Database enumerations sorted alphabetically // TODO: to be replaced by select statements
  EnpointType: {
    FSIOP_CALLBACK_URL: 1,
    ALARM_NOTIFICATION_URL: 2,
    ALARM_NOTIFICATION_TOPIC: 3
  },
  LedgerEntryType: {
    PRINCIPLE_VALUE: 1,
    INTERCHANGE_FEE: 2,
    HUB_FEE: 3
  },
  TransferParticipantRoleType: {
    PAYER_DFSP: 1,
    PAYEE_DFSP: 2,
    HUB: 3
  },
  TransferState: {
    RECEIVED_PREPARE: 'RECEIVED_PREPARE',
    RESERVED: 'RESERVED',
    RECEIVED_FULFIL: 'RECEIVED_FULFIL',
    COMMITTED: 'COMMITTED',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    REJECTED: 'REJECTED',
    PENDING_SETTLEMENT: 'PENDING_SETTLEMENT',
    SETTLED: 'SETTLED'
  },

  // Code specific (non-DB) enumerations sorted alphabetically
  transferEvent: {
    PREPARE: 'prepare',
    TRANSFER: 'transfer',
    FULFIL: 'fulfil',
    REJECT: 'reject',
    COMMIT: 'commit'
  },
  rejectionType: {
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  }
}
