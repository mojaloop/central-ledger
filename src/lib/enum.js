'use strict'

const EnpointType = {
  FSIOP_CALLBACK_URL: 1,
  ALARM_NOTIFICATION_URL: 2,
  ALARM_NOTIFICATION_TOPIC: 3
}
const LedgerEntryType = {
  PRINCIPLE_VALUE: 1,
  INTERCHANGE_FEE: 2,
  HUB_FEE: 3
}
const ParticipantLimitType = {
  NET_DEBIT_CAP: 1
}
const TransferParticipantRoleType = {
  PAYER_DFSP: 1,
  PAYEE_DFSP: 2,
  HUB: 3
}
const TransferState = {
  RECEIVED_PREPARE: 'RECEIVED_PREPARE',
  RESERVED: 'RESERVED',
  RECEIVED_FULFIL: 'RECEIVED_FULFIL',
  COMMITTED: 'COMMITTED',
  FAILED: 'FAILED',
  RESERVED_TIMEOUT: 'RESERVED_TIMEOUT',
  REJECTED: 'REJECTED',
  ABORTED: 'ABORTED',
  INVALID: 'INVALID',
  EXPIRED_PREPARED: 'EXPIRED_PREPARED',
  EXPIRED_RESERVED: 'EXPIRED_RESERVED'
}

// Code specific (non-DB) enumerations sorted alphabetically
const transferEventType = {
  PREPARE: 'prepare',
  POSITION: 'position',
  TRANSFER: 'transfer',
  FULFIL: 'fulfil',
  NOTIFICATION: 'notification'
}
const transferEventAction = {
  PREPARE: 'prepare',
  PREPARE_DUPLICATE: 'prepare-duplicate',
  TRANSFER: 'transfer',
  COMMIT: 'commit',
  ABORT: 'abort',
  TIMEOUT_RECEIVED: 'timeout-received',
  TIMEOUT_RESERVED: 'timeout-reserved',
  REJECT: 'reject',
  FAIL: 'fail',
  EVENT: 'event'
}
const rejectionType = {
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
}
const limitType = {
  NET_DEBIT_CAP: 1
}
const transferEventStatus = {
  SUCCESS: 'success',
  FAILED: 'failed'
}
const headers = {
  FSPIOP: {
    SWITCH: 'central-switch'
  }
}
const topicMap = {
  position: {
    'timeout-reserved': {
      functionality: transferEventType.POSITION,
      action: transferEventAction.ABORT
    }
  },
  notification: {
    'timeout-received': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'prepare-duplicate': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    }
  }
}

module.exports = {
  EnpointType,
  LedgerEntryType,
  ParticipantLimitType,
  TransferParticipantRoleType,
  TransferState,

  transferEventType,
  transferEventAction,
  rejectionType,
  limitType,
  transferEventStatus,
  headers,
  topicMap
}
