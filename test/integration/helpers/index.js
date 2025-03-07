/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
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
 * Valentin Genev <valentin.genev@modusbox.com>
 * Nikolay Anastasov <nikolay.anastasov@modusbox.com>
 * Shashikant Hirugade <shashikant.hirugade@modusbox.com>
 --------------
 ******/

'use strict'

const ErrorHandler = require('@mojaloop/central-services-error-handling')

exports.prepareNeededData = async (tableName) => {
  if (!tableName) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide a table name parameter to function "prepareNeededData"!')
  }

  switch (tableName) {
    case 'ilpPacket':
      return require('./ilpPacket').prepareData()
    case 'transferExtension':
      return require('./transferExtension').prepareData()
    case 'transferState':
      return require('./transferState').prepareData()
    case 'transferStateChange':
      return require('./transferStateChange').prepareData()
    case 'transferModel':
      return require('./transferTestHelper').prepareData()
    case 'transferError':
      return require('./transferError').prepareData()
    default:
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide a table name that has methods to insert its prepared data!')
  }
}

exports.deletePreparedData = async (tableName, data) => {
  if (!tableName || !data) {
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide a table name parameter to function "prepareNeededData"!')
  }

  switch (tableName) {
    case 'ilp':
      if (!data || !data.ilpId || !data.transferId || !data.payerName || !data.payeeName) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide ilpId, transferId, payerName and payeeName in order to delete the prepared data!')
      }
      return require('./ilpPacket').deletePreparedData(data.extensionId, data.transferId, data.payerName, data.payeeName)
    case 'extension':
      if (!data || !data.transferExtensionId || !data.transferId || !data.payerName || !data.payeeName) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide transferExtensionId, transferId in order to delete the prepared data!')
      }
      return require('./transferExtension').deletePreparedData(data.extensionId, data.transferId, data.payerName, data.payeeName)
    case 'transferStateChange':
      if (!data || !data.transferId || !data.payerName || !data.payeeName) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide transferId, payer and payee names in order to delete the prepared data!')
      }
      return require('./transferStateChange').deletePreparedData(data.transferId, data.payerName, data.payeeName)
    case 'transferModel':
      if (!data || !data.transferId || !data.payerName || !data.payeeName) {
        throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide transferId, payer and payee names in order to delete the prepared data!')
      }
      return require('./transferTestHelper').deletePreparedData(data.transferId, data.payerName, data.payeeName)
    default:
      throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, 'Please provide a table name that has methods to delete its prepared data!')
  }
}
