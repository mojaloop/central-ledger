'use strict'

const Db = require('../db')

const endpointType = async function () {
  try {
    let endpointType = {}
    for (let record of await Db.endpointType.find({})) {
      endpointType[`${record.name}`] = record.endpointTypeId
    }
    return endpointType
  } catch (err) {
    throw err
  }
}
const ledgerAccountType = async function () {
  try {
    let ledgerAccountType = {}
    for (let record of await Db.ledgerAccountType.find({})) {
      ledgerAccountType[`${record.name}`] = record.ledgerAccountTypeId
    }
    return ledgerAccountType
  } catch (err) {
    throw err
  }
}
const ledgerEntryType = async function () {
  try {
    let ledgerEntryType = {}
    for (let record of await Db.ledgerEntryType.find({})) {
      ledgerEntryType[`${record.name}`] = record.ledgerEntryTypeId
    }
    return ledgerEntryType
  } catch (err) {
    throw err
  }
}
const participantLimitType = async function () {
  try {
    let participantLimitType = {}
    for (let record of await Db.participantLimitType.find({})) {
      participantLimitType[`${record.name}`] = record.participantLimitTypeId
    }
    return participantLimitType
  } catch (err) {
    throw err
  }
}
const transferParticipantRoleType = async function () {
  try {
    let transferParticipantRoleType = {}
    for (let record of await Db.transferParticipantRoleType.find({})) {
      transferParticipantRoleType[`${record.name}`] = record.transferParticipantRoleTypeId
    }
    return transferParticipantRoleType
  } catch (err) {
    throw err
  }
}
const transferState = async function () {
  try {
    let transferState = {}
    for (let record of await Db.transferState.find({})) {
      transferState[`${record.transferStateId}`] = record.transferStateId
    }
    return transferState
  } catch (err) {
    throw err
  }
}
const transferStateEnum = async function () {
  try {
    let transferState = {}
    for (let record of await Db.transferState.find({})) {
      transferState[`${record.transferStateId}`] = record.enumeration
    }
    return transferState
  } catch (err) {
    throw err
  }
}
const all = async function () {
  try {
    return {
      endpointType: await endpointType(),
      ledgerAccountType: await ledgerAccountType(),
      ledgerEntryType: await ledgerEntryType(),
      participantLimitType: await participantLimitType(),
      transferParticipantRoleType: await transferParticipantRoleType(),
      transferState: await transferState(),
      transferStateEnum: await transferStateEnum()
    }
  } catch (err) {
    throw err
  }
}

// TODO: To be replaced throughout code with the above
const EnpointType = {
  FSIOP_CALLBACK_URL: 1,
  ALARM_NOTIFICATION_URL: 2,
  ALARM_NOTIFICATION_TOPIC: 3
}
const LedgerAccountType = {
  POSITION: 1,
  SETTLEMENT: 2,
  HUB_SETTLEMENT: 3
}
const LedgerEntryType = {
  PRINCIPLE_VALUE: 1,
  INTERCHANGE_FEE: 2,
  HUB_FEE: 3,
  POSITION_DEPOSIT: 4,
  POSITION_WITHDRAWAL: 5,
  SETTLEMENT_NET_RECIPIENT: 6,
  SETTLEMENT_NET_SENDER: 7,
  SETTLEMENT_NET_ZERO: 8,
  SETTLEMENT_ACCOUNT_DEPOSIT: 9,
  SETTLEMENT_ACCOUNT_WITHDRAWAL: 10
}
const ParticipantLimitType = {
  NET_DEBIT_CAP: 1
}
const TransferParticipantRoleType = {
  PAYER_DFSP: 1,
  PAYEE_DFSP: 2,
  HUB: 3,
  DFSP_SETTLEMENT_ACCOUNT: 4,
  DFSP_POSITION_ACCOUNT: 5
}
const TransferState = {
  ABORTED: 'ABORTED',
  COMMITTED: 'COMMITTED',
  EXPIRED_PREPARED: 'EXPIRED_PREPARED',
  EXPIRED_RESERVED: 'EXPIRED_RESERVED',
  FAILED: 'FAILED',
  INVALID: 'INVALID',
  RECEIVED_FULFIL: 'RECEIVED_FULFIL',
  RECEIVED_PREPARE: 'RECEIVED_PREPARE',
  REJECTED: 'REJECTED',
  RESERVED: 'RESERVED',
  RESERVED_TIMEOUT: 'RESERVED_TIMEOUT'
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
  EVENT: 'event',
  FULFIL: 'fulfil'
}
const rejectionType = {
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
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
    'commit': {
      functionality: transferEventType.POSITION,
      action: transferEventAction.FULFIL
    },
    'timeout-reserved': {
      functionality: transferEventType.POSITION,
      action: transferEventAction.ABORT
    },
    'reject': {
      functionality: transferEventType.POSITION,
      action: transferEventAction.ABORT
    }
  },
  transfer: {
    'prepare': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'prepare-duplicate': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'transfer': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'commit': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'abort': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'timeout-received': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'timeout-reserved': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    },
    'reject': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.TRANSFER
    }
  },
  notification: {
    'prepare': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'prepare-duplicate': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'transfer': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'commit': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'abort': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'timeout-received': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'timeout-reserved': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'reject': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    }
  }
}

module.exports = {
  endpointType,
  ledgerAccountType,
  ledgerEntryType,
  participantLimitType,
  transferParticipantRoleType,
  transferState,
  transferStateEnum,
  all,

  EnpointType,
  LedgerAccountType,
  LedgerEntryType,
  ParticipantLimitType,
  TransferParticipantRoleType,
  TransferState,

  transferEventType,
  transferEventAction,
  rejectionType,
  transferEventStatus,
  headers,
  topicMap
}
