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
const Logger = require('@mojaloop/central-services-logger')

const endpointType = async function () {
  try {
    const endpointType = {}
    for (const record of await Db.from('endpointType').find({})) {
      endpointType[`${record.name}`] = record.endpointTypeId
    }
    return endpointType
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const hubParticipant = async function () {
  try {
    return (await Db.from('participant').find({ participantId: Config.HUB_ID }))[0]
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const ledgerAccountType = async function () {
  try {
    const ledgerAccountType = {}
    for (const record of await Db.from('ledgerAccountType').find({})) {
      ledgerAccountType[`${record.name}`] = record.ledgerAccountTypeId
    }
    return ledgerAccountType
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const ledgerEntryType = async function () {
  try {
    const ledgerEntryType = {}
    for (const record of await Db.from('ledgerEntryType').find({})) {
      ledgerEntryType[`${record.name}`] = record.ledgerEntryTypeId
    }
    return ledgerEntryType
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const participantLimitType = async function () {
  try {
    const participantLimitType = {}
    for (const record of await Db.from('participantLimitType').find({})) {
      participantLimitType[`${record.name}`] = record.participantLimitTypeId
    }
    return participantLimitType
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const transferParticipantRoleType = async function () {
  try {
    const transferParticipantRoleType = {}
    for (const record of await Db.from('transferParticipantRoleType').find({})) {
      transferParticipantRoleType[`${record.name}`] = record.transferParticipantRoleTypeId
    }
    return transferParticipantRoleType
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const transferState = async function () {
  try {
    const transferState = {}
    for (const record of await Db.from('transferState').find({})) {
      transferState[`${record.transferStateId}`] = record.transferStateId
    }
    return transferState
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const transferStateEnum = async function () {
  try {
    const transferStateEnum = {}
    for (const record of await Db.from('transferState').find({})) {
      transferStateEnum[`${record.transferStateId}`] = record.enumeration
    }
    return transferStateEnum
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const bulkProcessingState = async function () {
  try {
    const bulkProcessingState = {}
    for (const record of await Db.from('bulkProcessingState').find({})) {
      bulkProcessingState[`${record.name}`] = record.bulkProcessingStateId
    }
    return bulkProcessingState
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const bulkTransferState = async function () {
  try {
    const bulkTransferState = {}
    for (const record of await Db.from('bulkTransferState').find({})) {
      bulkTransferState[`${record.bulkTransferStateId}`] = record.bulkTransferStateId
    }
    return bulkTransferState
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}
const bulkTransferStateEnum = async function () {
  try {
    const bulkTransferStateEnum = {}
    for (const record of await Db.from('bulkTransferState').find({})) {
      bulkTransferStateEnum[`${record.bulkTransferStateId}`] = record.enumeration
    }
    return bulkTransferStateEnum
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const enumsIds = [
  'endpointType',
  'hubParticipant',
  'ledgerAccountType',
  'ledgerEntryType',
  'participantLimitType',
  'transferParticipantRoleType',
  'transferState',
  'transferStateEnum',
  'bulkProcessingState',
  'bulkTransferState',
  'bulkTransferStateEnum'
]

module.exports = {
  endpointType,
  hubParticipant,
  ledgerAccountType,
  ledgerEntryType,
  participantLimitType,
  transferParticipantRoleType,
  transferState,
  transferStateEnum,
  bulkProcessingState,
  bulkTransferState,
  bulkTransferStateEnum,
  enumsIds
}
