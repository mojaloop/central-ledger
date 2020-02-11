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

const Enum = require('@mojaloop/central-services-shared').Enum.Settlements

const create = async function (request, h) {
  Sidecar.logRequest(request)
  try {
    const settlementGranularity = Enum.SettlementGranularity[request.payload.settlementGranularity]
    const settlementInterchange = Enum.SettlementInterchange[request.payload.settlementInterchange]
    const settlementDelay = Enum.SettlementDelay[request.payload.settlementDelay]
    const ledgerAccountType = await SettlementService.getLedgerAccountTypeName(request.payload.ledgerAccountType)
    if (!ledgerAccountType) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.ADD_PARTY_INFO_ERROR, 'Ledger account type was not found')
    }
    const settlementModelExist = await SettlementService.getByName(request.payload.name)
    if (settlementModelExist) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'This Settlement Model already exists')
    } else {
      await SettlementService.createSettlementModel(request.payload.name, true, settlementGranularity, settlementInterchange, settlementDelay, request.payload.currency, request.payload.requireLiquidityCheck, ledgerAccountType.ledgerAccountTypeId, request.payload.autoPositionReset)
      return h.response().code(201)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  create
}
