/*****
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

 * ModusBox
 - Georgi Georgiev <georgi.georgiev@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 --------------
 ******/
'use strict'

const SettlementService = require('../../domain/settlement')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Enums = require('../../lib/enumCached')
const Util = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum.Settlements
const Logger = require('../../shared/logger').logger
const rethrow = require('../../shared/rethrow')

const entityItem = ({ settlementModelId, name, isActive, settlementGranularityId, settlementInterchangeId, settlementDelayId, currencyId, requireLiquidityCheck, ledgerAccountTypeId, autoPositionReset }, ledgerAccountIds, settlementGranularityIds, settlementInterchangeIds, settlementDelayIds) => {
  return {
    settlementModelId,
    name,
    isActive: Enum.booleanType[isActive],
    settlementGranularity: settlementGranularityIds[settlementGranularityId],
    settlementInterchange: settlementInterchangeIds[settlementInterchangeId],
    settlementDelay: settlementDelayIds[settlementDelayId],
    currency: currencyId,
    requireLiquidityCheck: Enum.booleanType[requireLiquidityCheck],
    ledgerAccountTypeId: ledgerAccountIds[ledgerAccountTypeId],
    autoPositionReset: Enum.booleanType[autoPositionReset]

  }
}
const handleMissingRecord = (entity) => {
  if (!entity) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ID_NOT_FOUND, 'The requested resource could not be found.')
  }
  return entity
}

const getByName = async function (request) {
  const entity = await SettlementService.getByName(request.params.name)
  handleMissingRecord(entity)
  const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
  const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
  const settlementGranularityIds = Util.transpose(Enum.SettlementGranularity)
  const settlementInterchangeIds = Util.transpose(Enum.SettlementInterchange)
  const settlementDelayIds = Util.transpose(Enum.SettlementDelay)

  return entityItem(entity, ledgerAccountIds, settlementGranularityIds, settlementInterchangeIds, settlementDelayIds)
}
const getAll = async function () {
  const results = await SettlementService.getAll()
  const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
  const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
  const settlementGranularityIds = Util.transpose(Enum.SettlementGranularity)
  const settlementInterchangeIds = Util.transpose(Enum.SettlementInterchange)
  const settlementDelayIds = Util.transpose(Enum.SettlementDelay)
  return results.map(record => entityItem(record, ledgerAccountIds, settlementGranularityIds, settlementInterchangeIds, settlementDelayIds))
}

const update = async function (request) {
  try {
    const updatedEntity = await SettlementService.update(request.params.name, request.payload)
    if (request.payload.isActive !== undefined) {
      const isActiveText = request.payload.isActive ? Enum.isActiveText.activated : Enum.isActiveText.disabled
      const changeLog = JSON.stringify(Object.assign({}, request.params, { isActive: request.payload.isActive }))
      Logger.isInfoEnabled && Logger.info(`Settlement Model has been ${isActiveText} :: ${changeLog}`)
    }
    const ledgerAccountTypes = await Enums.getEnums('ledgerAccountType')
    const ledgerAccountIds = Util.transpose(ledgerAccountTypes)
    const settlementGranularityIds = Util.transpose(Enum.SettlementGranularity)
    const settlementInterchangeIds = Util.transpose(Enum.SettlementInterchange)
    const settlementDelayIds = Util.transpose(Enum.SettlementDelay)
    return entityItem(updatedEntity, ledgerAccountIds, settlementGranularityIds, settlementInterchangeIds, settlementDelayIds)
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'settlementModelUpdate' })
  }
}
const create = async function (request, h) {
  try {
    await SettlementService.createSettlementModel(request.payload)
    return h.response().code(201)
  } catch (err) {
    rethrow.rethrowAndCountFspiopError(err, { operation: 'settlementModelCreate' })
  }
}

module.exports = {
  create,
  getByName,
  getAll,
  update
}
