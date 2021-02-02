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
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const LedgerAccountTypesService = require('../../domain/ledgerAccountTypes')
const Sidecar = require('../../lib/sidecar')
const ErrorHandler = require('@mojaloop/central-services-error-handling')

const getAll = async function () {
  return LedgerAccountTypesService.getAll()
}
async function create (request, h) {
  Sidecar.logRequest(request)
  try {
    const ledgerAccountTypeExist = await LedgerAccountTypesService.getByName(request.payload.name)
    if (ledgerAccountTypeExist) {
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.CLIENT_ERROR, 'This Ledger Account Type already exists')
    } else {
      const body = request.payload
      await LedgerAccountTypesService.create(body.name, body.description, body.isActive, body.isSettleable)
      return h.response().code(201)
    }
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  create,
  // getByName,
  getAll
  // update
}
