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
  ParticipantLimitType: {
    NET_DEBIT_CAP: 1
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
    ABORTED: 'ABORTED',
    INVALID: 'INVALID'
  },

  // Code specific (non-DB) enumerations sorted alphabetically
  transferEventType: {
    PREPARE: 'prepare',
    POSITION: 'position',
    TRANSFER: 'transfer',
    FULFIL: 'fulfil'
  },
  transferEventAction: {
    PREPARE: 'prepare',
    TRANSFER: 'transfer',
    COMMIT: 'commit',
    ABORT: 'abort',
    TIMEOUT_RECEIVED: 'timeout-received',
    TIMEOUT_RESERVED: 'timeout-reserved',
    REJECT: 'reject',
    FAIL: 'fail'
  },
  rejectionType: {
    EXPIRED: 'expired',
    CANCELLED: 'cancelled'
  },
  limitType: {
    NET_DEBIT_CAP: 1
  },
  transferEventStatus: {
    SUCCESS: 'success',
    FAILED: 'failed'
  }
}
