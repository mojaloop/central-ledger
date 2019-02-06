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

 * Georgi Georgiev <lazola.lucas@modusbox.com>

 --------------
 ******/

'use strict'
const Config = require('./config')

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
      transferStateEnum: await transferStateEnum()
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

const EnpointType = {
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
  NOTIFICATION: 'notification',
  ADMIN: 'admin',
  GET: 'get'
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
  FULFIL: 'fulfil',
  POSITION: 'position'
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
    SWITCH: 'central-switch',
    DESTINATION: 'fspiop-destination'
  }
}

const topicMap = {
  position: {
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
    'reject': {
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
  all,
  transpose,

  EnpointType,
  LedgerAccountType,
  LedgerEntryType,
  ParticipantLimitType,
  TransferParticipantRoleType,
  TransferState,

  transferEventType,
  transferEventAction,
  adminTransferAction,
  adminNotificationActions,
  rejectionType,
  transferEventStatus,
  headers,
  topicMap
}
