/*****
 * @file This registers all handlers for the central-ledger API
 License
 --------------
 Copyright © 2020-2024 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * Georgi Georgiev <georgi.georgiev@modusbox.com>

 --------------
 ******/
'use strict'

const Config = require('./config')
const Db = require('./db')
const Logger = require('../shared/logger').logger

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

const settlementDelay = async function () {
  const settlementDelayName = {}

  const settlementDelayNamesList = await Db.from('settlementDelay').find({})
  if (settlementDelayNamesList) {
    for (const record of settlementDelayNamesList) {
      settlementDelayName[`${record.name}`] = record.settlementDelayId
    }
    return settlementDelayName
  }
}

const settlementDelayEnum = async function () {
  const settlementDelayEnum = {}

  const settlementDelayEnumsList = await Db.from('settlementDelay').find({})
  if (settlementDelayEnumsList) {
    for (const record of settlementDelayEnumsList) {
      settlementDelayEnum[`${record.name}`] = record.name
    }
    return settlementDelayEnum
  }
}

const settlementGranularity = async function () {
  const settlementGranularityName = {}

  const settlementGranularityNamesList = await Db.from('settlementGranularity').find({})
  if (settlementGranularityNamesList) {
    for (const record of settlementGranularityNamesList) {
      settlementGranularityName[`${record.name}`] = record.settlementGranularityId
    }
    return settlementGranularityName
  }
}

const settlementGranularityEnum = async function () {
  const settlementGranularityEnum = {}

  const settlementGranularityEnumsList = await Db.from('settlementGranularity').find({})
  if (settlementGranularityEnumsList) {
    for (const record of settlementGranularityEnumsList) {
      settlementGranularityEnum[`${record.name}`] = record.name
    }
    return settlementGranularityEnum
  }
}

const settlementInterchange = async function () {
  const settlementInterchangeName = {}

  const settlementInterchangeNamesList = await Db.from('settlementInterchange').find({})
  if (settlementInterchangeNamesList) {
    for (const record of settlementInterchangeNamesList) {
      settlementInterchangeName[`${record.name}`] = record.settlementInterchangeId
    }
    return settlementInterchangeName
  }
}

const settlementInterchangeEnum = async function () {
  const settlementInterchangeEnum = {}

  const settlementInterchangeEnumsList = await Db.from('settlementInterchange').find({})
  if (settlementInterchangeEnumsList) {
    for (const record of settlementInterchangeEnumsList) {
      settlementInterchangeEnum[`${record.name}`] = record.name
    }
    return settlementInterchangeEnum
  }
}

const settlementState = async function () {
  const settlementStateEnum = {}

  const settlementStateEnumsList = await Db.from('settlementState').find({})
  if (settlementStateEnumsList) {
    for (const state of settlementStateEnumsList) {
      settlementStateEnum[`${state.enumeration}`] = state.settlementStateId
    }
    return settlementStateEnum
  }
}

const settlementWindowState = async function () {
  const settlementWindowStateEnum = {}
  const settlementWindowStateEnumsList = await Db.from('settlementWindowState').find({})
  if (settlementWindowStateEnumsList) {
    for (const state of settlementWindowStateEnumsList) {
      settlementWindowStateEnum[`${state.enumeration}`] = state.settlementWindowStateId
    }
    return settlementWindowStateEnum
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
  'bulkTransferStateEnum',
  'settlementDelay',
  'settlementDelayEnum',
  'settlementGranularity',
  'settlementGranularityEnum',
  'settlementInterchange',
  'settlementInterchangeEnum',
  'settlementState',
  'settlementWindowState',
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
  settlementDelay,
  settlementDelayEnum,
  settlementGranularity,
  settlementGranularityEnum,
  settlementInterchange,
  settlementInterchangeEnum,
  settlementState,
  settlementWindowState,
  enumsIds
}
