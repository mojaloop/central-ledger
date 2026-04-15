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
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Deon Botha <deon.botha@modusbox.com>
 - Lazola Lucas <lazola.lucas@modusbox.com>
 - Claudio Viola <claudio.viola@modusbox.com>
 --------------
 ******/
const MLNumber = require('@mojaloop/ml-number')
const Transaction = require('../domain/transactions/index')
const BigNumber = require('bignumber.js')
const { logger } = require('../shared/logger')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Config = require('./config')

const { SCRIPT_TIMEOUT } = Config.HANDLERS.SETTINGS.RULES

async function getTransferFromCentralLedger (transferId) {
  const entity = await Transaction.getById(transferId)
  if (entity) {
    const transferObject = await Transaction.getTransactionObject(entity[0].value)
    return transferObject
  } else {
    logger.error(`No records for transferId ${transferId} was found`)
    throw ErrorHandler.Factory.createFSPIOPError(ErrorHandler.Enums.FSPIOPErrorCodes.INTERNAL_SERVER_ERROR, `No records for transferId ${transferId} was found`)
  }
}

function multiply (number1, number2, decimalPlaces) {
  const result = new MLNumber(number1).multiply(number2).toFixed(decimalPlaces, BigNumber.ROUND_HALF_UP)
  return result
}

function getExtensionValue (list, key) {
  return list.find((extension) => {
    return extension.key === key
  }).value
}

function log (message) {
  logger.info(message)
}

async function execute (script, payload) {
  try {
    const transfer = await getTransferFromCentralLedger(payload.id)
    const ledgerEntries = []
    const sandbox = {
      payload,
      log,
      transfer,
      multiply,
      getExtensionValue,
      addLedgerEntry: function (transferId, ledgerAccountTypeId, ledgerEntryTypeId, amount, currency, payerFspId, payeeFspId) {
        ledgerEntries.push({
          transferId,
          ledgerAccountTypeId,
          ledgerEntryTypeId,
          amount,
          currency,
          payerFspId,
          payeeFspId
        })
      }
    }
    script.runInNewContext(sandbox, { timeout: SCRIPT_TIMEOUT })
    return { ledgerEntries }
  } catch (err) {
    logger.error(err)
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}

module.exports = {
  execute
}
