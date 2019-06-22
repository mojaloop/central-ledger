/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>

 --------------
 ******/
'use strict'

const Config = require('./config')
const Db = require('./db')

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
const hubParticipant = async function () {
  try {
    return (await Db.participant.find({ participantId: Config.HUB_ID }))[0]
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
    let transferStateEnum = {}
    for (let record of await Db.transferState.find({})) {
      transferStateEnum[`${record.transferStateId}`] = record.enumeration
    }
    return transferStateEnum
  } catch (err) {
    throw err
  }
}
const bulkProcessingState = async function () {
  try {
    let bulkProcessingState = {}
    for (let record of await Db.bulkProcessingState.find({})) {
      bulkProcessingState[`${record.name}`] = record.bulkProcessingStateId
    }
    return bulkProcessingState
  } catch (err) {
    throw err
  }
}
const bulkTransferState = async function () {
  try {
    let bulkTransferState = {}
    for (let record of await Db.bulkTransferState.find({})) {
      bulkTransferState[`${record.bulkTransferStateId}`] = record.bulkTransferStateId
    }
    return bulkTransferState
  } catch (err) {
    throw err
  }
}
const bulkTransferStateEnum = async function () {
  try {
    let bulkTransferStateEnum = {}
    for (let record of await Db.bulkTransferState.find({})) {
      bulkTransferStateEnum[`${record.bulkTransferStateId}`] = record.enumeration
    }
    return bulkTransferStateEnum
  } catch (err) {
    throw err
  }
}
const all = async function () {
  try {
    return {
      endpointType: await endpointType(),
      hubParticipant: await hubParticipant(),
      ledgerAccountType: await ledgerAccountType(),
      ledgerEntryType: await ledgerEntryType(),
      participantLimitType: await participantLimitType(),
      transferParticipantRoleType: await transferParticipantRoleType(),
      transferState: await transferState(),
      transferStateEnum: await transferStateEnum(),
      bulkProcessingState: await bulkProcessingState(),
      bulkTransferState: await bulkTransferState(),
      bulkTransferStateEnum: await bulkTransferStateEnum()
    }
  } catch (err) {
    throw err
  }
}

const transpose = function (obj) {
  let transposed = new Map()
  for (let prop in obj) {
    transposed[obj[prop]] = prop
  }
  return transposed
}

const EndpointType = {
  ALARM_NOTIFICATION_URL: 1,
  ALARM_NOTIFICATION_TOPIC: 2,
  FSPIOP_CALLBACK_URL_TRANSFER_POST: 3,
  FSPIOP_CALLBACK_URL_TRANSFER_PUT: 4,
  FSPIOP_CALLBACK_URL_TRANSFER_ERROR: 5
}
const LedgerAccountType = {
  POSITION: 1,
  SETTLEMENT: 2,
  HUB_RECONCILIATION: 3,
  HUB_MULTILATERAL_SETTLEMENT: 4,
  HUB_FEE: 5
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
  DFSP_SETTLEMENT: 4,
  DFSP_POSITION: 5
}
const TransferState = {
  ABORTED_ERROR: 'ABORTED_ERROR',
  ABORTED_REJECTED: 'ABORTED_REJECTED',
  COMMITTED: 'COMMITTED',
  EXPIRED_PREPARED: 'EXPIRED_PREPARED',
  EXPIRED_RESERVED: 'EXPIRED_RESERVED',
  FAILED: 'FAILED',
  INVALID: 'INVALID',
  RECEIVED_ERROR: 'RECEIVED_ERROR',
  RECEIVED_FULFIL: 'RECEIVED_FULFIL',
  RECEIVED_PREPARE: 'RECEIVED_PREPARE',
  RECEIVED_REJECT: 'RECEIVED_REJECT',
  RESERVED: 'RESERVED',
  RESERVED_TIMEOUT: 'RESERVED_TIMEOUT'
}
const TransferStateEnum = {
  RECEIVED: 'RECEIVED',
  ABORTED: 'ABORTED',
  COMMITTED: 'COMMITTED',
  RESERVED: 'RESERVED'
}
const BulkProcessingState = {
  RECEIVED: 1,
  RECEIVED_DUPLICATE: 2,
  RECEIVED_INVALID: 3,
  ACCEPTED: 4,
  PROCESSING: 5,
  FULFIL_DUPLICATE: 6,
  FULFIL_INVALID: 7,
  COMPLETED: 8,
  REJECTED: 9,
  EXPIRED: 10
}
const BulkTransferState = {
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
  INVALID: 'INVALID',
  PENDING_FULFIL: 'PENDING_FULFIL',
  PENDING_INVALID: 'PENDING_INVALID',
  PENDING_PREPARE: 'PENDING_PREPARE',
  PROCESSING: 'PROCESSING',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED'
}
const BulkTransferStateEnum = {
  ACCEPTED: 'ACCEPTED',
  COMPLETED: 'COMPLETED',
  INVALID: 'REJECTED',
  PENDING_FULFIL: 'PROCESSING',
  PENDING_INVALID: 'PENDING',
  PENDING_PREPARE: 'PENDING',
  PROCESSING: 'PROCESSING',
  RECEIVED: 'RECEIVED',
  REJECTED: 'REJECTED'
}

// Code specific (non-DB) enumerations sorted alphabetically
const transferEventState = {
  SUCCESS: 'success',
  ERROR: 'error'
}
const transferEventType = {
  ADMIN: 'admin',
  BULK: 'bulk',
  BULK_TRANSFER: 'bulk-transfer',
  BULK_PROCESSING: 'bulk-processing',
  FULFIL: 'fulfil',
  GET: 'get',
  NOTIFICATION: 'notification',
  POSITION: 'position',
  PREPARE: 'prepare',
  TRANSFER: 'transfer'
}
const transferEventAction = {
  ABORT: 'abort',
  ABORT_DUPLICATE: 'abort-duplicate',
  // BULK_FULFIL: 'bulk-fulfil',
  BULK_COMMIT: 'bulk-commit',
  BULK_PREPARE: 'bulk-prepare',
  BULK_PROCESSING: 'bulk-processing',
  COMMIT: 'commit',
  EVENT: 'event',
  FAIL: 'fail',
  FULFIL: 'fulfil',
  FULFIL_DUPLICATE: 'fulfil-duplicate',
  GET: 'get',
  POSITION: 'position',
  PREPARE: 'prepare',
  PREPARE_DUPLICATE: 'prepare-duplicate',
  PROCESSING: 'processing',
  REJECT: 'reject',
  TIMEOUT_RECEIVED: 'timeout-received',
  TIMEOUT_RESERVED: 'timeout-reserved',
  TRANSFER: 'transfer'
}
const actionLetter = {
  abort: 'A',
  bulkPrepare: 'BP',
  // bulkFulfil: 'BF',
  bulkCommit: 'BC',
  commit: 'C',
  get: 'G',
  prepare: 'P',
  reject: 'R',
  timeout: 'T',
  unknown: '?'
}
const adminTransferAction = {
  RECORD_FUNDS_IN: 'recordFundsIn',
  RECORD_FUNDS_OUT_PREPARE_RESERVE: 'recordFundsOutPrepareReserve',
  RECORD_FUNDS_OUT_COMMIT: 'recordFundsOutCommit',
  RECORD_FUNDS_OUT_ABORT: 'recordFundsOutAbort'
}

const adminNotificationActions = {
  LIMIT_ADJUSTMENT: 'limit-adjustment'
}

const headers = {
  FSPIOP: {
    DESTINATION: 'fspiop-destination',
    SOURCE: 'fspiop-source',
    SWITCH: 'switch'
  }
}

const rejectionType = {
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
}

const transferEventStatus = {
  SUCCESS: 'success',
  FAILED: 'failed'
}

const topicMap = {
  'bulk-processing': {
    'bulk-prepare': {
      functionality: transferEventType.BULK,
      action: transferEventAction.PROCESSING
    }
  },
  notification: {
    'abort': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'abort-duplicate': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'bulk-prepare': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'bulk-processing': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'commit': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'fulfil-duplicate': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'get': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'limit-adjustment': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'position': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'prepare': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'prepare-duplicate': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'reject': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    },
    'timeout-received': {
      functionality: transferEventType.NOTIFICATION,
      action: transferEventAction.EVENT
    }
  },
  position: {
    'bulk-prepare': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    },
    'prepare': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    },
    'commit': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    },
    'timeout-reserved': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    },
    'reject': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    },
    'abort': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.POSITION
    }
  },
  prepare: {
    'bulk-prepare': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.PREPARE
    }
  },
  fulfil: {
    'commit': {
      functionality: transferEventType.TRANSFER,
      action: transferEventAction.FULFIL
    }
  }
}

module.exports = {
  endpointType,
  hubParticipant,
  ledgerAccountType,
  ledgerEntryType,
  participantLimitType,
  transferParticipantRoleType,
  transferState,
  transferStateEnum,
  BulkProcessingState,
  BulkTransferState,
  BulkTransferStateEnum,
  all,
  transpose,

  EndpointType,
  LedgerAccountType,
  LedgerEntryType,
  ParticipantLimitType,
  TransferParticipantRoleType,
  TransferState,
  TransferStateEnum,

  transferEventState,
  transferEventType,
  transferEventAction,
  actionLetter,
  adminTransferAction,
  adminNotificationActions,
  rejectionType,
  transferEventStatus,
  headers,
  topicMap
}
