/*****
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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const SettlementModelModel = require('../../models/settlement/settlementModel')
const LedgerAccountTypeModel = require('../../models/ledgerAccountType/ledgerAccountType')
const Enum = require('@mojaloop/central-services-shared').Enum.Settlements
const ParticipantService = require('../participant')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Util = require('@mojaloop/central-services-shared').Util

const createSettlementModel = async (settlementModel, trx = null) => {
  try {
    // check for existing hub account with the settlementModel to be able to create participant accounts automatically
    await ParticipantService.validateHubAccounts(settlementModel.currency)

    const settlementGranularityId = Enum.SettlementGranularity[settlementModel.settlementGranularity]
    const settlementInterchangeId = Enum.SettlementInterchange[settlementModel.settlementInterchange]
    const settlementDelayId = Enum.SettlementDelay[settlementModel.settlementDelay]

    const [ledgerAccountType, settlementAccountType] = await validateSettlementModel(settlementModel, settlementModel.settlementDelay, settlementModel.settlementGranularity, settlementModel.settlementInterchange, trx)
    await SettlementModelModel.create(settlementModel.name, true, settlementGranularityId,
      settlementInterchangeId, settlementDelayId, settlementModel.currency,
      settlementModel.requireLiquidityCheck,
      ledgerAccountType.ledgerAccountTypeId, settlementAccountType.ledgerAccountTypeId, settlementModel.autoPositionReset, trx)

    // create the accounts required for the settlementModel for existing participants
    await ParticipantService.createAssociatedParticipantAccounts(settlementModel.currency, ledgerAccountType.ledgerAccountTypeId, trx)
    await ParticipantService.createAssociatedParticipantAccounts(settlementModel.currency, settlementAccountType.ledgerAccountTypeId, trx)

    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
/* istanbul ignore next */
const getByName = async (name, trx = null) => {
  try {
    return await SettlementModelModel.getByName(name, trx)
  } catch (err) {
    /* istanbul ignore next */
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const getAll = async () => {
  try {
    return await SettlementModelModel.getAll()
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const getLedgerAccountTypeName = async (name) => {
  try {
    return await LedgerAccountTypeModel.getLedgerAccountByName(name)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const update = async (name, payload) => {
  try {
    const settlementModel = await SettlementModelModel.getByName(name)
    settlementModeExists(settlementModel)
    await SettlementModelModel.update(settlementModel, payload.isActive)
    settlementModel.isActive = +payload.isActive
    return settlementModel
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

const settlementModeExists = (settlementModel) => {
  if (settlementModel) {
    return settlementModel
  }
  throw ErrorHandler.Factory.createInternalServerFSPIOPError('Settlement Model does not exist')
}
/* istanbul ignore next */
const validateSettlementModel = async function (settlementModel, settlementDelay, settlementGranularity, settlementInterchange, trx = null) {
  const { isValid, reasons } = Util.Settlement.validateSettlementModel(settlementDelay, settlementGranularity, settlementInterchange)
  if (!isValid) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, reasons.join('. '))
  }
  const ledgerAccountType = await LedgerAccountTypeModel.getLedgerAccountByName(settlementModel.ledgerAccountType, trx)
  if (!ledgerAccountType) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Ledger account type was not found')
  }
  const settlementAccountType = await LedgerAccountTypeModel.getLedgerAccountByName(settlementModel.settlementAccountType, trx)
  if (!settlementAccountType) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Settlement account type was not found')
  }
  const settlementModelExist = await getByName(settlementModel.name, trx)
  if (settlementModelExist) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'Settlement Model already exists')
  }
  return [ledgerAccountType, settlementAccountType]
}

module.exports = {
  createSettlementModel,
  getLedgerAccountTypeName,
  getByName,
  getAll,
  update,
  validateSettlementModel
}
