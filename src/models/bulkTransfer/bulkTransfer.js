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

const Db = require('../../lib/db')
const Logger = require('@mojaloop/central-services-logger')

const getById = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .innerJoin('bulkTransferStateChange AS btsc', 'btsc.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .leftJoin('bulkTransferFulfilment AS btf', 'btf.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .where({ 'bulkTransfer.bulkTransferId': id })
        .orderBy('btsc.bulkTransferStateChangeId', 'desc')
        .select('bulkTransfer.bulkTransferId', 'btsc.bulkTransferStateId', 'btf.completedDate AS completedTimestamp',
          'payer.name AS payerFsp', 'payee.name AS payeeFsp', 'bulkTransfer.bulkQuoteId', 'bulkTransfer.expirationDate')
        .first()
      return result
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getByTransferId = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('bulkTransferAssociation AS bta', 'bta.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .innerJoin('bulkTransferStateChange AS btsc', 'btsc.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .leftJoin('bulkTransferFulfilment AS btf', 'btf.bulkTransferId', 'bulkTransfer.bulkTransferId')
        .where({ 'bta.transferId': id })
        .orderBy('btsc.bulkTransferStateChangeId', 'desc')
        .select('bulkTransfer.bulkTransferId', 'btsc.bulkTransferStateId', 'btf.completedDate AS completedTimestamp',
          'payer.name AS payerFsp', 'payee.name AS payeeFsp', 'bulkTransfer.bulkQuoteId',
          'bulkTransfer.expirationDate AS expiration')
        .first()
      return result
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

const getParticipantsById = async (id) => {
  try {
    return await Db.from('bulkTransfer').query(async (builder) => {
      const result = builder
        .innerJoin('participant AS payer', 'payer.participantId', 'bulkTransfer.payerParticipantId')
        .innerJoin('participant AS payee', 'payee.participantId', 'bulkTransfer.payeeParticipantId')
        .where({ 'bulkTransfer.bulkTransferId': id })
        .select('payer.name AS payerFsp', 'payee.name AS payeeFsp')
        .first()
      return result
    })
  } catch (err) {
    Logger.isErrorEnabled && Logger.error(err)
    throw err
  }
}

module.exports = {
  getById,
  getByTransferId,
  getParticipantsById
}
