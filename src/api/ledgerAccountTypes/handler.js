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
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
'use strict'

const LedgerAccountTypesService = require('../../domain/ledgerAccountTypes')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const rethrow = require('../../shared/rethrow')

const getAll = async function () {
  return LedgerAccountTypesService.getAll()
}
async function create (request, h) {
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
    rethrow.rethrowAndCountFspiopError(err, { operation: 'ledgerAccountTypesCreate' })
  }
}

module.exports = {
  create,
  // getByName,
  getAll
  // update
}
