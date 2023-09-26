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

 * Vijaya Kumar Guthi <vijaya.guthi@modusbox.com>
 --------------
 ******/

'use strict'

const { randomUUID } = require('crypto')
const TransferService = require('../../../src/domain/transfer')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Time = require('@mojaloop/central-services-shared').Util.Time
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators
const CentralEnums = require('@mojaloop/central-services-shared').Enum
const Config = require('../../../src/lib/config')
const Enums = require('../../../src/lib/enumCached')

const recordFundsInSampleData = {
  currency: 'USD',
  amount: 1000.0
}

exports.recordFundsIn = async (participantName, participantCurrencyId, recordFundsInObj = {}) => {
  try {
    const transferId = randomUUID()
    const payload = {
      transferId,
      externalReference: 'string',
      action: CentralEnums.Transfers.AdminTransferAction.RECORD_FUNDS_IN,
      amount: {
        amount: recordFundsInObj.amount || recordFundsInSampleData.amount,
        currency: recordFundsInObj.currency || recordFundsInSampleData.currency
      },
      reason: 'Reason for in flow of funds',
      extensionList: {}
    }

    const fundsInPayload = {
      ...payload,
      participantCurrencyId,
      payee: Config.HUB_NAME,
      payer: participantName
    }

    await Enums.initialize()
    const enums = {
      transferState: await Enums.getEnums('transferState'),
      transferParticipantRoleType: await Enums.getEnums('transferParticipantRoleType'),
      ledgerAccountType: await Enums.getEnums('ledgerAccountType'),
      ledgerEntryType: await Enums.getEnums('ledgerEntryType'),
      hubParticipant: await Enums.getEnums('hubParticipant')
    }

    const transactionTimestamp = Time.getUTCString(new Date())

    await Comparators.duplicateCheckComparator(transferId, fundsInPayload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    await TransferService.recordFundsIn(fundsInPayload, transactionTimestamp, enums)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
