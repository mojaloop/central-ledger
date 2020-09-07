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

const SettlementService = require('../../domain/settlement')
const Sidecar = require('../../lib/sidecar')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Enums = require('../../lib/enumCached')
const Util = require('@mojaloop/central-services-shared').Util
const Enum = require('@mojaloop/central-services-shared').Enum.Settlements
const Logger = require('@mojaloop/central-services-logger')

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
  Sidecar.logRequest(request)
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
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
const create = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    await SettlementService.createSettlementModel(request.payload)
    return h.response().code(201)
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  create,
  getByName,
  getAll,
  update
}
