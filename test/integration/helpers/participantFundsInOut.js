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

const Uuid = require('uuid4')
const TransferService = require('../../../src/domain/transfer')
const ErrorHandler = require('@mojaloop/central-services-error-handling')
const Time = require('@mojaloop/central-services-shared').Util.Time
const Comparators = require('@mojaloop/central-services-shared').Util.Comparators

const recordFundsInSampleData = {
  currency: 'USD',
  amount: 1000.0
}

exports.recordFundsIn = async (participantName, participantCurrencyId, recordFundsInObj = {}) => {
  try {
    const transferId = Uuid()
    const payload = {
      transferId,
      externalReference: 'string',
      action: 'recordFundsIn',
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
      payee: 'Hub',
      payer: participantName
    }

    const enums = {
      transferState: {
        RESERVED: 'RESERVED',
        COMMITTED: 'COMMITTED',
        ABORTED_REJECTED: 'ABORTED_REJECTED',
        RECEIVED_PREPARE: 'RECEIVED_PREPARE',
        RECEIVED_FULFIL: 'RECEIVED_FULFIL',
        RECEIVED_REJECT: 'RECEIVED_REJECT'
      },
      transferParticipantRoleType: {
        PAYER_DFSP: 1,
        PAYEE_DFSP: 2,
        HUB: 3,
        DFSP_SETTLEMENT: 4,
        DFSP_POSITION: 5
      },
      ledgerAccountType: {
        POSITION: 1,
        SETTLEMENT: 2,
        HUB_RECONCILIATION: 3,
        HUB_MULTILATERAL_SETTLEMENT: 4,
        INTERCHANGE_FEE: 5,
        INTERCHANGE_FEE_SETTLEMENT: 6
      },
      ledgerEntryType: {
        PRINCIPLE_VALUE: 1,
        INTERCHANGE_FEE: 2,
        HUB_FEE: 3,
        SETTLEMENT_NET_RECIPIENT: 6,
        SETTLEMENT_NET_SENDER: 7,
        SETTLEMENT_NET_ZERO: 8,
        RECORD_FUNDS_IN: 9,
        RECORD_FUNDS_OUT: 10
      },
      hubParticipant: {
        name: 'Hub'
      }
    }
    const transactionTimestamp = Time.getUTCString(new Date())

    await Comparators.duplicateCheckComparator(transferId, fundsInPayload, TransferService.getTransferDuplicateCheck, TransferService.saveTransferDuplicateCheck)
    await TransferService.recordFundsIn(fundsInPayload, transactionTimestamp, enums)
    return true
  } catch (err) {
    throw ErrorHandler.Factory.reformatFSPIOPError(err)
  }
}
