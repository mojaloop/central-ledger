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

 * Georgi Georgiev <georgi.georgiev@modusbox.com>
 --------------
 ******/

'use strict'

const error = {
  2001: 'Internal server error',
  2003: 'Service currently unavailable',
  3100: 'Generic validation error',
  3300: 'Transfer expired',
  3303: 'Client requested to use a transfer that has already expired',
  3106: 'Modified request',
  3208: 'Provided Transfer ID was not found on the server.',
  4001: 'Payer FSP has insufficient liquidity to perform the transfer',
  5000: 'Generic payee error',
  5100: 'Payee or Payee FSP rejected the request',
  5104: 'Payee rejected the financial transaction'
}

const createErrorInformation = (errorCode, extensionList) => {
  return {
    errorCode,
    errorDescription: error[errorCode],
    extensionList
  }
}

const getErrorDescription = (errorCode) => {
  return error[errorCode]
}

module.exports = {
  createErrorInformation,
  getErrorDescription
}
